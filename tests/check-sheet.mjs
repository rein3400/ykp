// Check what tabs exist in the spreadsheet
const SHEET_ID = "1rdKV6BJMsDr3lKhIoxQXA8hbto9s8p0rOajHFYNsPVg";

const resp = await fetch(
  `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
  { headers: { "User-Agent": "curl/8.0" } }
);
console.log("status:", resp.status);
const text = await resp.text();
console.log(text.slice(0, 2000));