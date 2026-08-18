/**
 * @ykp/ui/format
 * Indonesian-aware formatting helpers shared across YKP ERP apps.
 *
 * Implementation lives in the leaf package @ykp/format so pure-TS
 * packages like @ykp/engine can use it without dragging React deps.
 */

export {
  formatIdr,
  parseIdr,
  formatDateWib,
  nowWib,
  wibToUtc,
  utcToWib,
} from "../../../format/src/index";