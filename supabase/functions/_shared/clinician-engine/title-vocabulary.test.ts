import { assert, assertFalse } from "jsr:@std/assert@1";
import { titleKeepsEveryWord } from "./title-vocabulary.ts";
Deno.test("nurse manager never widens to bedside nurse", () => {
  assertFalse(titleKeepsEveryWord("emergency room nurse manager", "emergency room nurse"));
  assert(titleKeepsEveryWord("emergency room nurse manager", "emergency room nurse manager - nights"));
});
