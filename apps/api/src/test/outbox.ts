import { emailHandler } from "../email/messages";
import { runDueJobs, type Handlers } from "../outbox/worker";
import type { VerifactuTransport } from "../verifactu/transport";
import { verifactuHandler } from "../verifactu/submit";
import { db, mailer, storage } from "./harness";

/** What the fake AEAT answers a record instead of recording it: an error code and message. */
export type FakeAnswer = { status: "AceptadoConErrores" | "Incorrecto"; code: string; message: string };

const NS = "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws";
const soap = (body: string) =>
  `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body>${body}</env:Body></env:Envelope>`;
const idFactura = (taxId: string, number: string, date: string) =>
  `<tik:IDEmisorFactura>${taxId}</tik:IDEmisorFactura><tik:NumSerieFactura>${number}</tik:NumSerieFactura><tik:FechaExpedicionFactura>${date}</tik:FechaExpedicionFactura>`;

/**
 * A fake AEAT web service. It keeps the envelopes it gets and the records it
 * holds, refuses the ones it already holds as duplicates (error 3000), and
 * answers queries about them, as RespuestaSuministro.xsd and
 * RespuestaConsultaLR.xsd describe.
 */
export function fakeAeat() {
  const envelopes: string[] = [];
  const state = {
    envelopes,
    /** The records it holds, by `NIF|number|DD-MM-YYYY`, with their fingerprint. */
    held: new Map<string, { hash: string; status: "Correcto" | "AceptadoConErrores" }>(),
    /** By invoice number; the default records it as correct. */
    answers: new Map<string, FakeAnswer>(),
    /** Answer with a SOAP fault instead. */
    fault: null as string | null,
    faultCode: "env:Client",
    /** Don't answer at all; `afterRecording` records the submission first, as after a lost answer. */
    down: null as null | "before" | "afterRecording",
    waitSeconds: 60,
  };
  const transport: VerifactuTransport = {
    environment: "test",
    async send(envelope) {
      envelopes.push(envelope);
      if (state.down === "before") throw new Error("The AEAT didn't answer in time.");
      if (state.fault)
        return soap(
          `<env:Fault><faultcode>${state.faultCode}</faultcode><faultstring>${state.fault}</faultstring></env:Fault>`,
        );
      const answer = envelope.includes("ConsultaFactuSistemaFacturacion") ? query(envelope) : submission(envelope);
      if (state.down === "afterRecording") throw new Error("The AEAT didn't answer in time.");
      return answer;
    },
  };

  function submission(envelope: string) {
    const statuses: string[] = [];
    const lines = [...envelope.matchAll(/<sf:RegistroAlta>([\s\S]*?)<\/sf:RegistroAlta>/g)].map(([, record]) => {
      const [, taxId, number, date] =
        /<sf:IDFactura><sf:IDEmisorFactura>([^<]*)<\/sf:IDEmisorFactura><sf:NumSerieFactura>([^<]*)<\/sf:NumSerieFactura><sf:FechaExpedicionFactura>([^<]*)</.exec(
          record!,
        )!;
      const hash = /<sf:TipoHuella>01<\/sf:TipoHuella><sf:Huella>([^<]*)</.exec(record!)![1]!;
      const key = `${taxId}|${number}|${date}`;
      const held = state.held.get(key);
      const answer = state.answers.get(number!);
      let status = "Correcto";
      let error = "";
      if (held) {
        status = "Incorrecto";
        error =
          "<tikR:CodigoErrorRegistro>3000</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>Registro de facturación duplicado.</tikR:DescripcionErrorRegistro>" +
          `<tikR:RegistroDuplicado><tik:IdPeticionRegistroDuplicado>20261005102100000001</tik:IdPeticionRegistroDuplicado><tik:EstadoRegistroDuplicado>${held.status === "Correcto" ? "Correcta" : "AceptadaConErrores"}</tik:EstadoRegistroDuplicado></tikR:RegistroDuplicado>`;
      } else if (answer) {
        status = answer.status;
        error = `<tikR:CodigoErrorRegistro>${answer.code}</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>${answer.message}</tikR:DescripcionErrorRegistro>`;
      }
      if (status !== "Incorrecto") state.held.set(key, { hash, status: status as "Correcto" | "AceptadoConErrores" });
      statuses.push(status);
      return `<tikR:RespuestaLinea><tikR:IDFactura>${idFactura(taxId!, number!, date!)}</tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion><tikR:EstadoRegistro>${status}</tikR:EstadoRegistro>${error}</tikR:RespuestaLinea>`;
    });
    const overall = statuses.every((s) => s === "Correcto")
      ? "Correcto"
      : statuses.every((s) => s === "Incorrecto")
        ? "Incorrecto"
        : "ParcialmenteCorrecto";
    return soap(
      `<tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="${NS}/RespuestaSuministro.xsd" xmlns:tik="${NS}/SuministroInformacion.xsd"><tikR:CSV>A-TEST123</tikR:CSV><tikR:TiempoEsperaEnvio>${state.waitSeconds}</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>${overall}</tikR:EstadoEnvio>${lines.join("")}</tikR:RespuestaRegFactuSistemaFacturacion>`,
    );
  }

  function query(envelope: string) {
    const taxId = /<sf:ObligadoEmision><sf:NombreRazon>[^<]*<\/sf:NombreRazon><sf:NIF>([^<]*)</.exec(envelope)![1]!;
    const number = /<con:NumSerieFactura>([^<]*)</.exec(envelope)![1]!;
    const date = /<sf:FechaExpedicionFactura>([^<]*)</.exec(envelope)![1]!;
    const held = state.held.get(`${taxId}|${number}|${date}`);
    const found = held
      ? `<tikLRRC:ResultadoConsulta>ConDatos</tikLRRC:ResultadoConsulta><tikLRRC:RegistroRespuestaConsultaFactuSistemaFacturacion><tikLRRC:IDFactura>${idFactura(taxId, number, date)}</tikLRRC:IDFactura><tikLRRC:DatosRegistroFacturacion><tikLRRC:TipoHuella>01</tikLRRC:TipoHuella><tikLRRC:Huella>${held.hash}</tikLRRC:Huella></tikLRRC:DatosRegistroFacturacion><tikLRRC:EstadoRegistro><tikLRRC:TimestampUltimaModificacion>2026-10-05T10:21:00+02:00</tikLRRC:TimestampUltimaModificacion><tikLRRC:EstadoRegistro>${held.status}</tikLRRC:EstadoRegistro></tikLRRC:EstadoRegistro></tikLRRC:RegistroRespuestaConsultaFactuSistemaFacturacion>`
      : `<tikLRRC:ResultadoConsulta>SinDatos</tikLRRC:ResultadoConsulta>`;
    return soap(
      `<tikLRRC:RespuestaConsultaFactuSistemaFacturacion xmlns:tikLRRC="${NS}/RespuestaConsultaLR.xsd" xmlns:tik="${NS}/SuministroInformacion.xsd"><tikLRRC:IndicadorPaginacion>N</tikLRRC:IndicadorPaginacion>${found}</tikLRRC:RespuestaConsultaFactuSistemaFacturacion>`,
    );
  }

  /** The submissions sent for an organization: each record names it as the installation. */
  const sentFor = (organizationId: string) =>
    envelopes.filter((envelope) => envelope.includes(`<sf:NumeroInstalacion>${organizationId}<`));
  /** The queries sent about an issuer's invoices. */
  const queriesFor = (taxId: string) =>
    envelopes.filter(
      (envelope) => envelope.includes("ConsultaFactuSistemaFacturacion") && envelope.includes(`<sf:NIF>${taxId}<`),
    );
  return Object.assign(state, { transport, sentFor, queriesFor });
}

export const software = {
  producerName: "cuentalibre Test",
  producerTaxId: "B00000000",
  name: "cuentalibre",
  id: "FI",
  version: "1.0",
};

/** Runs the outbox jobs that are due, with the given AEAT. */
export function runJobs(transport: VerifactuTransport | null = null) {
  const handlers: Handlers = {
    verifactu: verifactuHandler(db, transport, software),
    email: emailHandler(db, storage, mailer),
  };
  return runDueJobs(db, handlers);
}
