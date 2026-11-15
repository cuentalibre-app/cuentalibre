import { describe, expect, it } from "vitest";
import { appMapPage } from "./app-map";

describe("the app map", () => {
  it("is the guide's page, in step with the navigation", async () => {
    await expect(appMapPage()).toMatchFileSnapshot("../../../../site/src/content/docs/guia/mapa.md");
  });
});
