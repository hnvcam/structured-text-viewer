import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/rpc";

const electroview = new Electroview({
  rpc: Electroview.defineRPC<AppRPC>({
    handlers: {
      requests: {},
      messages: {
        directorySelected: ({ dirPath }) => {
          window.dispatchEvent(
            new CustomEvent("directorySelected", { detail: { dirPath } })
          );
        },
      },
    },
  }),
});

export const rpc = electroview.rpc!;
