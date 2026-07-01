function annotateDuplicates(records) {
  const seen = new Set();
  return records.map((record) => {
    const key = [
      record.transactionId,
      record.orderNo,
      record.profileId,
      record.amountUsd,
      record.customerEmail
    ].filter(Boolean).join("|").toLowerCase();
    const isDuplicate = Boolean(key && seen.has(key));
    if (key) seen.add(key);
    return { ...record, isDuplicate };
  });
}

function payloadFromRecords({ service, mode, records, sourceWindow, importHash }) {
  const annotated = annotateDuplicates(Array.isArray(records) ? records : []);
  const needReview = annotated.filter((record) => record.needReview).length;
  const duplicates = annotated.filter((record) => record.isDuplicate);
  return {
    ok: true,
    service,
    version: "0.1.0",
    mode,
    scanned: annotated.length,
    matched: annotated.length,
    records: annotated,
    duplicates,
    needReview,
    lastSyncAt: new Date().toISOString(),
    sourceWindow,
    importHash,
    summary: {
      scannedCount: annotated.length,
      matchedCount: annotated.length,
      parsedCount: annotated.length,
      writableCount: annotated.length - needReview,
      skippedDuplicates: duplicates.length,
      needReviewCount: needReview
    }
  };
}

module.exports = { annotateDuplicates, payloadFromRecords };
