import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchHero } from "@/components/search/SearchHero";
import { BroadSearchPanel } from "@/components/search/BroadSearchPanel";

vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function render(element: ReactElement) {
  await act(async () => root.render(element));
}

describe("Talent Search reset and edit behavior", () => {
  it("starts over with a blank, focused input after a same-page reset", async () => {
    await render(<SearchHero onSearch={() => {}} loading={false} initialQuery="cardiologists in Dallas" focusKey={0} />);
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe("cardiologists in Dallas");
    expect(textarea.selectionStart).toBe(textarea.value.length);

    await render(<SearchHero onSearch={() => {}} loading={false} initialQuery="" focusKey={1} />);
    expect(textarea.value).toBe("");
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(0);
  });

  it("keeps the exact query and places the cursor at the end for Edit search", async () => {
    const query = "Emergency room nurse managers in Colorado";
    await render(<SearchHero onSearch={() => {}} loading={false} initialQuery={query} />);
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(document.activeElement).toBe(textarea);
    expect(textarea.value).toBe(query);
    expect(textarea.selectionStart).toBe(query.length);
    expect(textarea.selectionEnd).toBe(query.length);
  });
});

describe("Broad search refinement", () => {
  it("uses only the recruiter's typed refinement and removes the old nationwide scope", async () => {
    const onSearch = vi.fn();
    await render(
      <BroadSearchPanel
        query="Every physician in the United States"
        total={1_000_000}
        roleLabel="Physicians"
        onSearch={onSearch}
        onReset={() => {}}
      />,
    );

    const input = container.querySelector("#search-within") as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, "Dallas");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    await act(async () => (container.querySelector("button[type=submit]") as HTMLButtonElement).click());

    expect(onSearch).toHaveBeenCalledWith("Every physician, Dallas");
  });

  it("does not run a broad search with an empty refinement", async () => {
    const onSearch = vi.fn();
    await render(
      <BroadSearchPanel
        query="All nurses nationwide"
        total={2_000_000}
        roleLabel="Nurses"
        onSearch={onSearch}
        onReset={() => {}}
      />,
    );
    expect((container.querySelector("button[type=submit]") as HTMLButtonElement).disabled).toBe(true);
    expect(onSearch).not.toHaveBeenCalled();
  });
});
