import {
  PUT as updateMaster,
  DELETE as archiveMaster,
} from "@/app/api/warehouse/masters/[kind]/[id]/route";
import { handler } from "@/lib/http";
export const PUT = handler(async (request, { params }) =>
  updateMaster(request, {
    params: Promise.resolve({ kind: "items", id: params.id }),
  }),
);
export const DELETE = handler(async (request, { params }) =>
  archiveMaster(request, {
    params: Promise.resolve({ kind: "items", id: params.id }),
  }),
);
