/** Latest Registro Mercantil changes of some sample companies, by NIF, until there is an un proveedor de informes connection. Made up. */

export interface RegistryChange {
  /** ISO date it was published. */
  date: string;
  description: string;
}

export const registryChanges: Record<string, RegistryChange[]> = {
  // Estudio Norte S.L.
  B12345674: [
    { date: "2026-09-30", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-06-12", description: "Administradores (Reelección)" },
    { date: "2026-03-04", description: "BORME (Cambio de domicilio social)" },
    { date: "2025-11-20", description: "Denominaciones y Marcas (Solicitud Marca)" },
  ],
  // Agencia Brisa S.L.
  B87654323: [
    { date: "2026-10-09", description: "Incidencias de pago (Alta en fichero de impagados)" },
    { date: "2026-08-27", description: "BORME (Ampliación de capital)" },
    { date: "2026-07-15", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-05-02", description: "Administradores (Cese)" },
    { date: "2026-05-02", description: "Administradores (Nombramiento)" },
  ],
  // Lumen Software S.A.
  A55667786: [
    { date: "2026-10-14", description: "Prensa (Datos financieros - 13/10/2026)" },
    { date: "2026-10-02", description: "Licitaciones (Alta de licitación adjudicada)" },
    { date: "2026-09-18", description: "BORME (Nombramientos)" },
    { date: "2026-09-18", description: "BORME (Revocaciones)" },
    { date: "2026-07-24", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-04-10", description: "Subvenciones (Concesión)" },
  ],
  // Coworking La Nave S.L.
  B86543212: [
    { date: "2026-07-30", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-02-16", description: "BORME (Ampliación del objeto social)" },
  ],
  // Telefonía Meseta S.A.
  A28765436: [
    { date: "2026-10-07", description: "Administradores (Nombramiento)" },
    { date: "2026-09-25", description: "Prensa (Resultados del primer semestre)" },
    { date: "2026-08-03", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-06-30", description: "BORME (Reducción de capital)" },
  ],
  // Seguros Atlántico S.A.
  A15234560: [
    { date: "2026-08-21", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-05-28", description: "Administradores (Reelección)" },
  ],
  // Tecnoplaza Informática S.L.
  B30456784: [
    { date: "2026-09-08", description: "Concursal (Declaración de concurso voluntario)" },
    { date: "2026-07-31", description: "Incidencias de pago (Alta en fichero de impagados)" },
    { date: "2026-04-22", description: "BORME (Depósito de cuentas anuales 2025)" },
  ],
  // Transitarios del Sur S.L.
  B11223450: [{ date: "2026-07-29", description: "BORME (Depósito de cuentas anuales 2025)" }],
  // Estación de Servicio Los Pinos S.L.
  B45123981: [
    { date: "2026-06-18", description: "BORME (Depósito de cuentas anuales 2025)" },
    { date: "2026-01-12", description: "BORME (Transformación de sociedad)" },
  ],
};
