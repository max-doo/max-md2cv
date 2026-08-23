import { describe, expect, it } from "vitest";
import { EXIT_CODE_BY_ERROR, Md2cvError } from "../../src/node/errors";

describe("stable error exit codes", () => {
  it("keeps environment, render, filesystem, and argument failures distinct", () => {
    expect(EXIT_CODE_BY_ERROR.INVALID_ARGUMENT).toBe(2);
    expect(EXIT_CODE_BY_ERROR.BROWSER_NOT_FOUND).toBe(4);
    expect(EXIT_CODE_BY_ERROR.RENDER_TIMEOUT).toBe(5);
    expect(EXIT_CODE_BY_ERROR.OUTPUT_EXISTS).toBe(6);
    expect(new Md2cvError("OUTPUT_EXISTS", "exists").code).toBe("OUTPUT_EXISTS");
  });
});
