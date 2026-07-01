const DEFAULT_START_CELL = "B9";

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    if (!rows.length) return jsonResponse({ ok: false, error: "No rows" });

    const spreadsheet = payload.sheetUrl
      ? SpreadsheetApp.openByUrl(payload.sheetUrl)
      : SpreadsheetApp.getActiveSpreadsheet();
    const sheet = payload.sheetName
      ? spreadsheet.getSheetByName(payload.sheetName)
      : spreadsheet.getActiveSheet();
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: "Sheet not found: " + payload.sheetName,
        availableSheets: spreadsheet.getSheets().map(function(item) { return item.getName(); })
      });
    }

    const start = parseCell_(payload.startCell || DEFAULT_START_CELL);
    const direction = String(payload.direction || "down").toLowerCase() === "up" ? "up" : "down";
    const width = Math.max.apply(null, rows.map(function(row) { return row.length; }));
    const values = rows.map(function(row) {
      const next = row.slice();
      while (next.length < width) next.push("");
      return next;
    });

    const targetRow = direction === "up"
      ? findEmptyRowUp_(sheet, start.row, start.column, values.length)
      : findEmptyRowDown_(sheet, start.row, start.column, values.length);

    if (!payload.dryRun) {
      sheet.getRange(targetRow, start.column, values.length, width).setValues(values);
    }

    return jsonResponse({
      ok: true,
      dryRun: Boolean(payload.dryRun),
      sheetName: sheet.getName(),
      startCell: payload.startCell || DEFAULT_START_CELL,
      direction: direction,
      row: targetRow,
      column: start.column,
      count: values.length
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function findEmptyRowDown_(sheet, startRow, column, rowCount) {
  const maxRows = Math.max(sheet.getMaxRows(), startRow + rowCount - 1);
  const values = sheet.getRange(startRow, column, maxRows - startRow + 1, 1).getDisplayValues();
  for (let i = 0; i < values.length; i += 1) {
    if (canFit_(values, i, rowCount)) return startRow + i;
  }
  const nextRow = maxRows + 1;
  sheet.insertRowsAfter(sheet.getMaxRows(), rowCount);
  return nextRow;
}

function findEmptyRowUp_(sheet, startRow, column, rowCount) {
  const firstRow = Math.max(1, startRow - 2000);
  const values = sheet.getRange(firstRow, column, startRow - firstRow + 1, 1).getDisplayValues();
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const targetIndex = i - rowCount + 1;
    if (targetIndex >= 0 && canFit_(values, targetIndex, rowCount)) return firstRow + targetIndex;
  }
  return Math.max(1, startRow - rowCount + 1);
}

function canFit_(values, startIndex, rowCount) {
  for (let i = 0; i < rowCount; i += 1) {
    if (values[startIndex + i] && values[startIndex + i][0]) return false;
  }
  return true;
}

function parseCell_(cell) {
  const match = String(cell || DEFAULT_START_CELL).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error("Invalid start cell");
  return {
    column: columnNameToNumber_(match[1]),
    row: Number(match[2])
  };
}

function columnNameToNumber_(name) {
  let result = 0;
  for (let i = 0; i < name.length; i += 1) {
    result = result * 26 + name.charCodeAt(i) - 64;
  }
  return result;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
