import { emailHandler } from "../email/messages";
import { runDueJobs, type Handlers } from "../outbox/worker";
import type { VerifactuTransport } from "../verifactu/transport";
import { verifactuHandler } from "../verifactu/submit";
import { db, mailer, storage } from "./harness";

/** What the fake AEAT answers each record: its status, or an error code and message. */
export type FakeAnswer =
  { status: "Correcto" } | { status: "AceptadoConErrores" | "Incorrecto"; code: string; message: string };

/** A fake AEAT web service: keeps the envelopes it gets and answers as told. */
export function fakeAeat() {
  const envelopes: string[] = [];
  const state = {
    envelopes,
    /** By invoice number; the default accepts. */
    answers: new Map<string, FakeAnswer>(),
    /** Answer with a SOAP fault instead. */
    fault: null as string | null,
    waitSeconds: 60,
  };
  const transport: VerifactuTransport = {
    environment: "test",
    async send(envelope) {
      envelopes.push(envelope);
      if (state.fault)
        return `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><env:Fault><faultcode>env:Client</faultcode><faultstring>${state.fault}</faultstring></env:Fault></env:Body></env:Envelope>`;
      const lines = [
        ...envelope.matchAll(
          /<sf:IDFactura><sf:IDEmisorFactura>([^<]*)<\/sf:IDEmisorFactura><sf:NumSerieFactura>([^<]*)<\/sf:NumSerieFactura><sf:FechaExpedicionFactura>([^<]*)</g,
        ),
      ].map(([, taxId, number, date]) => {
        const answer = state.answers.get(number!) ?? { status: "Correcto" };
        const error =
          answer.status === "Correcto"
            ? ""
            : `<tikR:CodigoErrorRegistro>${answer.code}</tikR:CodigoErrorRegistro><tikR:DescripcionErrorRegistro>${answer.message}</tikR:DescripcionErrorRegistro>`;
        return `<tikR:RespuestaLinea><tikR:IDFactura><tik:IDEmisorFactura>${taxId}</tik:IDEmisorFactura><tik:NumSerieFactura>${number}</tik:NumSerieFactura><tik:FechaExpedicionFactura>${date}</tik:FechaExpedicionFactura></tikR:IDFactura><tikR:Operacion><tik:TipoOperacion>Alta</tik:TipoOperacion></tikR:Operacion><tikR:EstadoRegistro>${answer.status}</tikR:EstadoRegistro>${error}</tikR:RespuestaLinea>`;
      });
      return `<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/"><env:Body><tikR:RespuestaRegFactuSistemaFacturacion xmlns:tikR="r" xmlns:tik="t"><tikR:CSV>A-TEST123</tikR:CSV><tikR:TiempoEsperaEnvio>${state.waitSeconds}</tikR:TiempoEsperaEnvio><tikR:EstadoEnvio>Correcto</tikR:EstadoEnvio>${lines.join("")}</tikR:RespuestaRegFactuSistemaFacturacion></env:Body></env:Envelope>`;
    },
  };
  /** The envelopes sent for an organization: each record names it as the installation. */
  const sentFor = (organizationId: string) =>
    envelopes.filter((envelope) => envelope.includes(`<sf:NumeroInstalacion>${organizationId}<`));
  return Object.assign(state, { transport, sentFor });
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
