import { createActions, mainNav, moreNav, phoneShortcuts, phoneTabs, secondaryNav, type NavLeaf } from "./nav";

/*
 * The app map: where every section, list and shortcut sits on a computer and on a phone,
 * written from the navigation itself. It is a page of the user guide, which the help chat
 * answers from, so the chat names the menus the app really has. app-map.test.ts keeps the
 * page in step with this file.
 */

const TAXES = "/impuestos";
const mainNavItem = (to: string) => mainNav.find((item) => item.to === to);

const leafLabel = (leaf: NavLeaf) =>
  [leaf.label, leaf.selfEmployedOnly && "(solo autónomos)", leaf.desktopOnly && "(solo en el ordenador)"]
    .filter(Boolean)
    .join(" ");

const list = (leaves: NavLeaf[]) => new Intl.ListFormat("es").format(leaves.map(leafLabel));

function desktop(): string[] {
  const lines = [
    "## En el ordenador",
    "",
    "El menú de la izquierda tiene todas las secciones. Las que tienen varias pantallas se despliegan al pulsarlas. De arriba abajo:",
    "",
  ];
  for (const item of [...mainNav, ...secondaryNav]) {
    lines.push(item.children ? `- **${item.label}**: ${list(item.children)}.` : `- **${item.label}**`);
  }
  lines.push(
    "",
    "El botón **Crear**, arriba del menú, abre los atajos para crear:",
    "",
    ...createActions.map((group) => `- ${group.map((action) => `**${action.label}**`).join(", ")}.`),
    "",
    "Abajo del todo, el botón con tus iniciales abre tu cuenta: **Configuración**, el tema claro u oscuro y **Cerrar sesión**.",
  );
  return lines;
}

function phone(): string[] {
  const ordinals = ["el primero", "el segundo", "el tercero", "el cuarto", "el quinto", "el sexto", "el séptimo"];
  const tabs = phoneTabs.map((tab, i) => {
    const place =
      i === phoneTabs.length - 1 ? "el último" : i === (phoneTabs.length - 1) / 2 ? "el del centro" : ordinals[i];
    if (!place) throw new Error(`The app map has no word for tab ${i + 1}: add it to the ordinals.`);
    if (tab.kind === "create")
      return `- **${tab.label}** (${place}): abre ${phoneShortcuts.map((s) => `**${s.label}**`).join(", ")}.`;
    if (tab.kind === "more") return `- **${tab.label}** (${place}): abre la hoja **Más**, con el resto de secciones.`;
    const first = mainNavItem(tab.to)?.children?.[0];
    const opens = tab.to === TAXES ? ", desde el que se entra en cada modelo" : "";
    return `- **${tab.label}** (${place})${first ? `: abre **${first.label}**${opens}` : ""}.`;
  });
  const more = moreNav.map((entry) =>
    entry.kind === "group" ? `- **${entry.title}**: ${list(entry.links)}.` : `- **${entry.item.label}**`,
  );
  // A tab opens its section's first page; the taxes summary links to every form, the other sections' pages aren't reached
  const reachable = new Set([
    ...phoneShortcuts.map((s) => s.to),
    ...moreNav.flatMap((entry) => (entry.kind === "group" ? entry.links.map((l) => l.to) : [entry.item.to])),
  ]);
  const elsewhere = phoneTabs
    .flatMap((tab) => (tab.kind === "link" && tab.to !== TAXES ? (mainNavItem(tab.to)?.children?.slice(1) ?? []) : []))
    .filter((leaf) => !leaf.desktopOnly && !reachable.has(leaf.to));
  const desktopOnly = [
    ...new Map(
      mainNav
        .flatMap((item) => item.children?.filter((leaf) => leaf.desktopOnly) ?? [])
        .map((leaf) => [leaf.label, leaf]),
    ).values(),
  ];
  return [
    "## En el móvil",
    "",
    `Abajo hay una barra flotante con ${phoneTabs.length} botones de solo icono. De izquierda a derecha:`,
    "",
    ...tabs,
    "",
    "La hoja **Más** reúne, de arriba abajo:",
    "",
    ...more,
    "",
    ...(elsewhere.length > 0
      ? [`En el móvil, los menús no llevan a ${list(elsewhere)}: se abren desde el ordenador.`, ""]
      : []),
    ...(desktopOnly.length > 0
      ? [
          `${new Intl.ListFormat("es").format(desktopOnly.map((leaf) => leaf.label))} no están en el móvil: se usan desde el ordenador.`,
          "",
        ]
      : []),
    "Tu cuenta (**Configuración**, el tema y **Cerrar sesión**) se abre con el botón de tus iniciales, arriba en **Inicio**.",
  ];
}

const commonLines = [
  "## En todas las pantallas",
  "",
  "- Arriba de cada pantalla está su título y, al lado, sus acciones. En el ordenador, la principal es un botón con texto, como **Nueva factura**; en el móvil es un botón **+** arriba a la derecha.",
  "- El botón **Asistente** (un icono de robot) abre este chat de ayuda: a la derecha en el ordenador y como una hoja en el móvil.",
  "- En los listados, cada fila tiene un botón de tres puntos con sus acciones (descargar el PDF, enviar, cobrar, rectificar, eliminar…). En el móvil, las filas solo muestran ese botón.",
  "- El periodo (un trimestre o el año) se elige en el selector de la parte de arriba de los listados, los impuestos y los informes.",
];

/** The app map as the guide page it is published as, front matter included. */
export function appMapPage(): string {
  return [
    "---",
    'title: "Mapa de la aplicación"',
    'label: "Mapa"',
    'description: "Dónde está cada sección y cada atajo de cuentalibre, en el ordenador y en el móvil."',
    "section: guide",
    "order: 10",
    "---",
    "",
    "<!-- Written from apps/web/src/components/layout/nav.ts. Don't edit it by hand: run `pnpm --filter @cuentalibre/web test -u`. -->",
    "",
    "cuentalibre tiene las mismas funciones en el ordenador y en el móvil, pero las reparte de otra forma en la pantalla.",
    "",
    ...desktop(),
    "",
    ...phone(),
    "",
    ...commonLines,
    "",
  ].join("\n");
}
