import { Electroview } from "electrobun/view";
import type { AppRPC } from "../shared/rpc";

const electroview = new Electroview({
  rpc: Electroview.defineRPC<AppRPC>({
    handlers: {
      requests: {},
      messages: {},
    },
  }),
});

export const rpc = electroview.rpc!;
