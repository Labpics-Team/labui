// Гейт регенерационной дисциплины: contract.css на диске обязан быть
// байт-в-байт тем, что генерирует движок СЕЙЧАС (опубликованный пакет +
// паспорт + Figma-якорь). Дрейф любого из трёх источников без регенерации —
// красный тест, а не тихое расхождение файла с движком.
//
// Независимость истины не теряется: золотая сверка (golden-parity) меряет
// движок против ЗАМОРОЖЕННОГО якоря; здесь меряется только дисциплина
// артефакта.
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { generateContract } from "../generate-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const contractPath = join(here, "..", "..", "colors-stub", "contract.css");
const referencePath = join(
  here,
  "..",
  "..",
  "colors-stub",
  "figma-reference.css",
);

describe("сгенерированный контракт", () => {
  it("файл на диске байт-в-байт равен свежей генерации", async () => {
    const disk = (await readFile(contractPath, "utf8")).replace(/\r\n/g, "\n");
    const fresh = (await generateContract()).replace(/\r\n/g, "\n");
    expect(disk).toBe(fresh);
  });

  it("покрытие якоря полное: ни одна переменная не потеряна", async () => {
    const names = (css) =>
      new Set([...css.matchAll(/(--lab-[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
    const anchor = names(await readFile(referencePath, "utf8"));
    const contract = names(await readFile(contractPath, "utf8"));
    const lost = [...anchor].filter((n) => !contract.has(n));
    expect(lost, "переменные якоря, потерянные генерацией").toEqual([]);
  });
});
