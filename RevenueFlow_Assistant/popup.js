let rawText = "";
let records = [];
let bridgeQueueRecords = [];
let activeIndex = 0;
let currentRow = "";
let historyItems = [];
let config = {};
let saveTimer = null;
let rateRefreshTimer = null;
let googleAuthInProgress = false;
let connectedGmail = "";
let lastVerifiedSheetWriteAt = "";
let lastVerifiedSheetWrite = null;
let lastRateRefreshAt = "";
let lastRateInfo = null;
let rateRefreshPromise = null;
let gmailScanStats = { queried: 0, ignored: 0, unmatched: 0, matched: 0 };
let gatewayRules = [];
let workflowContext = {
  businessOrder: null,
  paymentRecord: null,
  sheetRecord: null,
  invoiceDraft: null,
  matchResult: null,
  readiness: null,
  emailBridge: null
};
let productRuleUndoStack = [];

const GOOGLE_AUTH_TIMEOUT_MS = 45000;
const GOOGLE_API_TIMEOUT_MS = 30000;
const GOOGLE_CACHE_TIMEOUT_MS = 4000;
const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const GMAIL_SCAN_DAYS = 365;
const GMAIL_SCAN_LIMIT = 100;
const EXCHANGE_RATE_API_URL = "https://open.er-api.com/v6/latest/USD";
const RATE_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const RATE_API_TIMEOUT_MS = 10000;
const REVENUEFLOW_SHEET_HEADERS = ["Date", "Customer", "Reference", "Product / service", "USD", "Provider", "VND gross", "Rate", "Invoice no.", "Invoice date"];
const SHEET_FIELD_KEYS = ["date", "customerName", "orderNo", "product", "usd", "provider", "grossVnd", "rate", "invoiceNo", "invoiceDate"];
const DEFAULT_SHEET_FIELD_COLUMNS = {
  date: "A",
  customerName: "B",
  orderNo: "C",
  product: "D",
  usd: "E",
  provider: "F",
  grossVnd: "G",
  rate: "H",
  invoiceNo: "I",
  invoiceDate: "J"
};
const VI_ACCOUNTING_SHEET_FIELD_COLUMNS = { ...DEFAULT_SHEET_FIELD_COLUMNS };

const defaultRules = [];

const defaultProductAliases = [];

const legacySampleProductNames = [
  "Subscription / recurring payment",
  "Standard product or service",
  "Professional service package",
  "Business service package",
  "Enterprise / custom project"
];

const INTERNAL_PRODUCT_PATTERN = /legacy sample product/i;
const REVIEW_PRODUCT_PATTERN = /^need review/i;

const defaultPaymentSourceRules = [
  { provider: "PayPal", domains: ["paypal.com", "intl.paypal.com"], keywords: ["payment received", "you received a payment", "subscription payment", "recurring payment"] },
  { provider: "Stripe", domains: ["stripe.com"], keywords: ["payment succeeded", "payment receipt", "invoice paid", "successful payment"] },
  { provider: "Generic", domains: [], keywords: ["order paid", "payment confirmed", "invoice paid"] }
];

function serializePaymentSourceRules(rules) {
  return rules.map((rule) => `${rule.provider}|${rule.domains.join(",")}|${rule.keywords.join(",")}`).join("\n");
}

const defaultConfig = {
  configVersion: "6.16.0",
  rate: 26124,
  rateInfo: null,
  product: "",
  rulesText: defaultRules.map((r) => `${r.amount}=${r.name}`).join("\n"),
  productAliases: defaultProductAliases,
  sourceRulesText: serializePaymentSourceRules(defaultPaymentSourceRules),
  ruleMode: "default",
  gatewayRules: null,
  invoiceNo: "",
  invoiceDate: "",
  sheetUrl: "",
  targetGmailAccount: "",
  sheetName: "Payments",
  sheetStartCell: "A2",
  sheetDirection: "down",
  sheetFieldColumns: DEFAULT_SHEET_FIELD_COLUMNS,
  writeCustomFields: true,
  customFieldsSheetColumn: "L",
  vatPercent: 0,
  paypalFeePercent: 0,
  autoCopy: true,
  strictValidation: false,
  appendAccounting: false,
  accountingPreset: "invoice_standard",
  accountingTemplateText: "",
  accountingConnector: "csv",
  accountingConnectorUrl: "",
  accountingConnectorNotes: "",
  autoIncrementInvoice: true,
  autoWriteSheet: false,
  enableEmailBridge: false,
  bridgeUrl: "",
  cloudSyncUrl: "",
  cloudSyncToken: "",
  emailSourceMode: "gmail",
  fontFamily: "Inter",
  fontSize: 14,
  primaryColor: "#1267b1",
  panelColor: "#ffffff",
  theme: "light",
  language: "vi",
  dismissedTips: {}
};

const fontOptions = [
  { value: "Inter", css: 'Inter,"Segoe UI",Roboto,Arial,"Noto Sans",sans-serif' },
  { value: "Segoe UI", css: '"Segoe UI",Arial,"Noto Sans",sans-serif' },
  { value: "Roboto", css: 'Roboto,Arial,"Noto Sans",sans-serif' },
  { value: "Arial", css: 'Arial,"Noto Sans",sans-serif' },
  { value: "Noto Sans", css: '"Noto Sans","Segoe UI",Arial,sans-serif' },
  { value: "Tahoma", css: 'Tahoma,Arial,sans-serif' }
];

const labels = {
  vi: {
    appTitle: "RevenueFlow Assistant",
    enableSheetsApiAdmin: "Quản trị viên: Bật Google Sheets API một lần",
    googleSheetsApiDisabled: "Google Sheets API chưa được bật cho RevenueFlow. Quản trị viên Netbase cần bật API một lần; khách hàng không phải tự cấu hình.",
    googleSheetsScopeMissing: "RevenueFlow chưa được cấp quyền Google Sheets. Hãy bấm Save lại và chọn Cho phép quyền Google Sheets.",
    privacyNoticeTitle: "Quyền riêng tư:",
    privacyNoticeText: "RevenueFlow chỉ đọc email payment qua Gmail OAuth. Ứng dụng không yêu cầu hoặc lưu mật khẩu email.",
    privacyNoticeLink: "Xem chính sách",
    appDesc: "Quét payment received trong Gmail, kiểm tra nhanh, rồi lưu vào Google Sheet.",
    quickStartEyebrow: "Bảng điều khiển",
    quickStartTitle: "Quét payment mới",
    quickStartHelp: "Bấm nút xanh. RevenueFlow sẽ quét Gmail đã cấp quyền và đưa payment nhận tiền vào danh sách.",
    gmailAccountLabel: "Gmail đang quét",
    gmailAccountDisconnected: "Chưa kết nối Gmail",
    connectGmailAccount: "Kết nối Gmail",
    changeGmailAccount: "Cách đổi tài khoản",
    accountSwitchHelp: "Chrome đang cấp quyền bằng tài khoản của hồ sơ hiện tại. Muốn dùng Gmail khác: chuyển sang hồ sơ Chrome của tài khoản đó, mở RevenueFlow, rồi bấm Kết nối Gmail.",
    disconnectGmailAccount: "Ngắt kết nối hiện tại",
    gmailDisconnected: "Đã ngắt kết nối Gmail. Hãy chuyển hồ sơ Chrome nếu muốn dùng tài khoản khác.",
    gmailAccountConnected: "Đã kết nối Gmail",
    gmailSourceHelp: "Nguồn: Gmail API của tài khoản này, không phải email đang mở trong trình duyệt.",
    quickCardScanTitle: "Quét payment",
    quickCardScanHelp: "Bấm nút xanh để lấy payment received từ Gmail đã cấp quyền.",
    quickCardReviewTitle: "Kiểm tra",
    quickCardReviewHelp: "Chọn payment và sửa thông tin còn thiếu.",
    quickCardSheetTitle: "Lưu Sheet",
    quickCardSheetHelp: "Khi dữ liệu đúng, bấm lưu vào Google Sheet.",
    workflowEyebrow: "Quy trình",
    workflowTitle: "Làm theo thứ tự từ trên xuống dưới",
    workflowHelp: "Nút chính nằm ở bước 1. Các phần bên dưới chỉ dùng để kiểm tra và lưu dữ liệu.",
    stepSyncTitle: "Quét email",
    stepSyncHelp: "Tự quét Gmail, không cần mở từng email.",
    stepReviewTitle: "Kiểm tra dữ liệu",
    stepReviewHelp: "Bổ sung dữ liệu còn thiếu.",
    stepWriteTitle: "Ghi Sheet",
    stepWriteHelp: "Ghi dòng đã kiểm tra.",
    advancedBridgeSummary: "Trạng thái Gmail",
    emailSyncTitle: "Bước 1: Lấy payment mới",
    emailSyncBadge: "Nút chính",
    emailSyncHelp: "Bấm nút xanh. RevenueFlow sẽ quét Gmail, lấy payment received và đưa vào danh sách bên dưới.",
    paymentInboxTitle: "Payment tìm thấy",
    dashboardTitle: "Tóm tắt",
    dashboardHelp: "Doanh thu được khử trùng từ payment đã quét và lịch sử xử lý.",
    monthRevenueLabel: "Doanh thu tháng này",
    paymentCountLabel: "Payment",
    duplicateCountLabel: "Nghi trùng",
    exportCsv: "Xuất CSV",
    providerFilterLabel: "Lọc theo cổng thanh toán",
    providerAll: "Tất cả",
    inboxDuplicate: "Giao dịch trùng",
    reviewReady: "Sẵn sàng ghi Sheet",
    reviewReadyHelp: "Thông tin đã đủ. Kiểm tra lần cuối rồi bấm Lưu vào Sheet.",
    reviewBlocked: "Chưa thể ghi Sheet",
    reviewDuplicateHelp: "Giao dịch này có dấu hiệu trùng. Hãy đối chiếu Transaction ID trước khi lưu.",
    confirmDuplicate: "Đã kiểm tra, vẫn tiếp tục lưu",
    reviewSelectPayment: "Chọn một payment để bắt đầu kiểm tra.",
    paymentInboxHelp: "Chọn một dòng để kiểm tra và lưu.",
    paymentInboxEmpty: "Chưa có payment nào. Bấm Bắt đầu xử lý payment để quét Gmail.",
    inboxScanSummary: "Đã quét {scanned} email liên quan · tìm thấy {matched} payment",
    inboxSaved: "Đã ghi Sheet",
    inboxStatusColumn: "Trạng thái",
    inboxDateColumn: "Ngày",
    inboxCustomerColumn: "Khách hàng",
    inboxReferenceColumn: "Reference",
    inboxAmountColumn: "USD",
    inboxTypeColumn: "Loại",
    inboxReady: "OK",
    inboxReview: "Cần kiểm tra",
    inboxNew: "Mới",
    smartFilterAll: "Tất cả",
    smartFilterReady: "Sẵn sàng",
    smartFilterReview: "Cần kiểm tra",
    smartFilterDuplicate: "Trùng",
    smartFilterSaved: "Đã lưu",
    smartInboxReadyHelp: "Sẵn sàng ghi Sheet",
    smartInboxSavedHelp: "Đã xác minh trong Sheet",
    bulkReadyLabel: "thanh toán sẵn sàng",
    bulkCopyReady: "Sao chép mục sẵn sàng",
    bulkSaveReady: "Lưu mục sẵn sàng",
    bulkNoneReady: "Chưa có thanh toán sẵn sàng để xử lý hàng loạt.",
    bulkCopiedReady: "Đã sao chép các thanh toán sẵn sàng.",
    bulkSavedReady: "Đã lưu các thanh toán sẵn sàng vào Sheet.",
    queueSummaryText: "Sẵn sàng {ready} · Cần kiểm tra {review} · Trùng {duplicate} · Đã lưu {saved}",
    queueNextSave: "Tiếp theo: lưu các thanh toán sẵn sàng vào Sheet.",
    queueNextReview: "Tiếp theo: chọn từng thanh toán cần kiểm tra.",
    queueNextDuplicate: "Tiếp theo: kiểm tra giao dịch trùng trước khi lưu.",
    queueNextScan: "Tiếp theo: quét Gmail để tìm payment received mới.",
    queueNextDone: "Hoàn tất: các thanh toán tìm thấy đã được xử lý.",
    bulkSavedReadyDetailed: "Đã lưu {saved} thanh toán sẵn sàng vào Sheet. Bỏ qua {skipped} mục cần kiểm tra, trùng hoặc đã lưu.",
    setupGmailStep: "Kết nối Gmail",
    setupSheetStep: "Chuẩn bị Google Sheet",
    setupScanStep: "Quét payment",
    setupDone: "Đã xong",
    setupMissing: "Cần làm",
    guidedGmailTitle: "Bước 1: Kết nối Gmail",
    guidedGmailHelp: "Kết nối Gmail bằng Google OAuth để RevenueFlow lấy payment received. Ứng dụng không lưu mật khẩu Gmail.",
    guidedSheetTitle: "Bước 2: Chuẩn bị Google Sheet",
    guidedSheetHelp: "Tạo Sheet mới hoặc dán link Sheet bạn muốn lưu dữ liệu doanh thu.",
    guidedScanTitle: "Bước 3: Quét payment đầu tiên",
    guidedScanHelp: "Bấm quét để tìm payment received trong Gmail và đưa vào danh sách review.",
    guidedReadyTitle: "Sẵn sàng xử lý payment",
    guidedReadyHelp: "Nguồn payment và Sheet đã sẵn sàng. Bấm nút xanh để quét payment mới.",
    guidedDismiss: "Đã hiểu",
    createDefaultSheet: "Tạo Sheet RevenueFlow",
    defaultSheetCreated: "Đã tạo Sheet RevenueFlow và thêm tiêu đề cột.",
    quickFixConnectGmail: "Kết nối Gmail",
    quickFixCreateSheet: "Tạo Sheet mới",
    quickFixOpenSettings: "Mở cài đặt Sheet",
    quickFixTryAgain: "Thử lại",
    reviewSummaryTitle: "Tóm tắt payment",
    reviewSummaryReady: "Sẵn sàng lưu",
    reviewSummaryNeedsReview: "Cần kiểm tra",
    reviewSummarySaved: "Đã ghi Sheet",
    reviewSummaryDuplicate: "Nghi trùng",
    reviewAcceptTitle: "Đã review, cho phép lưu",
    reviewMoreTitle: "Thao tác khác",
    reviewAccepted: "Đã đánh dấu review OK. Bạn có thể copy hoặc lưu Sheet.",
    clearCurrentPayment: "Xóa dữ liệu trong form",
    removeCurrentPayment: "Xóa payment này",
    currentPaymentCleared: "Đã xóa dữ liệu trong form hiện tại.",
    currentPaymentRemoved: "Đã xóa payment khỏi danh sách.",
    demoPaymentLoaded: "Đã nạp payment demo để kiểm tra giao diện.",
    loadDemoPayment: "Xem demo",
    sheetHealthTitle: "Tình trạng Sheet",
    sheetHealthReady: "Sheet đã sẵn sàng",
    sheetHealthMissing: "Chưa có Sheet. RevenueFlow sẽ tự tạo hoặc bạn có thể bấm tạo ngay.",
    sheetHealthNextCell: "Dòng tiếp theo",
    sheetHealthAccount: "Tài khoản",
    sheetMappingTitle: "Cột lưu dữ liệu",
    sheetMappingHelp: "Chọn cột cho các thông tin chính. Để mặc định nếu chưa chắc.",
    sheetPresetStandard: "Mẫu phổ thông",
    sheetPresetVietnam: "Mẫu kế toán VN",
    sheetPreviewTitle: "Xem trước khi ghi",
    sheetPreviewHelp: "Bấm chữ cái cột để đổi chỗ ghi trong Sheet.",
    sheetPreviewEditHint: "Bấm vào chữ cái cột để đổi chỗ ghi.",
    sheetColumnPrompt: "Nhập cột Sheet cho {field}",
    sheetColumnUpdated: "Đã chuyển {field} sang cột {column}.",
    sheetColumnInvalid: "Cột Sheet chưa hợp lệ. Ví dụ: B, C, AA.",
    sheetPreflightTitle: "Cần kiểm tra trước khi ghi",
    sheetPreflightMissing: "Thiếu: {fields}",
    sheetPreflightDuplicate: "Giao dịch có thể bị trùng. Hãy kiểm tra trước khi lưu.",
    sheetPreflightNoSheet: "Chưa có link Sheet. RevenueFlow sẽ tự tạo Sheet riêng khi bạn bấm lưu.",
    sheetPreflightColumnBeforeStart: "Một số cột nằm trước ô bắt đầu. RevenueFlow sẽ dùng cột mặc định an toàn.",
    sheetVerifiedTitle: "Đã ghi và xác minh",
    sheetVerifiedHelp: "RevenueFlow đã đọc lại Google Sheet để chắc chắn dữ liệu có trong Sheet.",
    sheetVerifiedRange: "Vị trí",
    sheetVerifiedTime: "Lúc xác minh",
    sheetVerifiedOpen: "Mở đúng dòng vừa ghi",
    sheetColumnDate: "Ngày",
    sheetColumnCustomer: "Khách hàng",
    sheetColumnReference: "Mã tham chiếu",
    sheetColumnProduct: "Sản phẩm",
    sheetColumnUsd: "USD",
    sheetColumnProvider: "Cổng",
    sheetColumnVnd: "VND",
    sheetColumnRate: "Tỷ giá",
    sheetColumnInvoiceNo: "Số HĐ",
    sheetColumnInvoiceDate: "Ngày HĐ",
    paymentDetailTitle: "Chi tiết payment",
    paymentDetailReason: "Lý do cần kiểm tra",
    paymentDetailSource: "Nguồn email",
    paymentDetailRaw: "Subject",
    applyRecommendedPresets: "Dùng preset khuyên dùng",
    presetsApplied: "Đã bật preset phổ biến cho PayPal, Stripe, Paddle, WooCommerce, Shopify và bank transfer.",
    backupSettingsTitle: "Sao lưu & chuyển máy",
    backupSettingsHelp: "Xuất file cấu hình để chuyển sang Chrome profile hoặc máy khác. File không chứa mật khẩu Gmail.",
    exportSettings: "Xuất cấu hình",
    importSettings: "Nhập cấu hình",
    settingsExported: "Đã xuất cấu hình RevenueFlow.",
    settingsImported: "Đã nhập cấu hình. Kiểm tra lại Gmail và Sheet trước khi lưu dữ liệu.",
    manualGmailTitle: "Cách cũ: đọc email đang mở trong Gmail",
    manualGmailHelp: "Chế độ này đã ẩn trong bản global. Gmail Sync sẽ tự quét email.",
    primaryAction: "Tạo dòng từ Gmail",
    buildOnly: "Chỉ tạo dòng",
    forceCopy: "Vẫn copy",
    extractedTitle: "Kiểm tra payment",
    extractedHelp: "Sửa thông tin nếu cần trước khi lưu.",
    settingsTitle: "Cài đặt",
    settingsEyebrow: "Thiết lập",
    settingsSubtitle: "Chỉ chỉnh những phần cần thiết. Người dùng thường chỉ cần Google Sheet và Rule đọc payment.",
    setupCardGoogleTitle: "Kết nối Google",
    setupCardGoogleHelp: "Dùng để quét Gmail và ghi Sheet.",
    setupCardSheetTitle: "Google Sheet",
    setupCardSheetHelp: "Chọn tab và ô bắt đầu.",
    setupCardRulesTitle: "Rule",
    setupCardRulesHelp: "Bật cổng thanh toán và map sản phẩm.",
    settingsToggleTitle: "Mở cấu hình",
    rateSettingsTitle: "Tỷ giá & hóa đơn",
    rateSettingsHelp: "RevenueFlow tự cập nhật tỷ giá khi bạn dùng extension. Bấm Cập nhật tỷ giá nếu muốn lấy giá mới ngay.",
    liveRateLabel: "Tỷ giá USD/VND",
    refreshRateNow: "Làm mới",
    rateUpdatingShort: "đang cập nhật",
    rateManualFallbackShort: "đang dùng tỷ giá đã lưu",
    rateLiveShort: "tự cập nhật",
    sheetSettingsTitle: "Google Sheet & account",
    googleSheetSetupHelp: "Set where records are saved. Re-check the Sheet after changing tab name or start cell.",
    behaviorSettingsTitle: "Tự động hóa & an toàn",
    behaviorSettingsHelp: "Giữ mặc định nếu không chắc. Các tùy chọn này quyết định khi nào được copy hoặc ghi Sheet.",
    saveSettings: "Lưu",
    getRate: "Cập nhật tỷ giá",
    dateLabel: "Ngày",
    emailTypeLabel: "Loại email",
    customerLabel: "Khách hàng",
    emailLabel: "Email",
    referenceLabel: "Đơn hàng / Tham chiếu",
    usdLabel: "USD",
    transactionLabel: "Transaction ID",
    profileLabel: "Profile ID",
    productLabel: "Tên hàng hóa / dịch vụ",
    addProduct: "Thêm mục",
    deleteSelectedProduct: "Xóa mục đang chọn",
    undoProductChange: "Hoàn tác",
    productUndoDone: "Đã hoàn tác thay đổi sản phẩm.",
    productUndoEmpty: "Chưa có thay đổi sản phẩm để hoàn tác.",
    accountingAdvancedTitle: "Nâng cao: VAT / phí cổng",
    accountingAdvancedHelp: "Chỉ dùng khi bật thêm cột kế toán. Không ảnh hưởng dòng Sheet cơ bản.",
    productAmountLabel: "USD (không bắt buộc)",
    productNameLabel: "Tên sản phẩm / dịch vụ",
    productAdded: "Đã thêm mục sản phẩm/dịch vụ.",
    customFieldsTitle: "Chi tiết email",
    writeCustomFieldsLabel: "Ghi chi tiết đã chọn",
    customFieldsSheetColumnLabel: "Cột",
    customFieldsSheetColumnHelp: "Chỉ các chi tiết được bật Ghi Sheet mới ghi vào cột này.",
    addCustomFieldTitle: "Thêm chi tiết",
    customFieldsCount: "{count} chi tiết",
    customFieldWriteOn: "Ghi Sheet",
    customFieldWriteOff: "Không ghi",
    sheetFieldWriteOn: "Ghi",
    sheetFieldWriteOff: "Không ghi",
    customFieldNamePlaceholder: "Tên mục",
    customFieldValuePlaceholder: "Giá trị",
    accountingHandoffTitle: "Dữ liệu cho app kế toán",
    accountingHandoffHelp: "Xuất file CSV/import từ payment đã kiểm tra. RevenueFlow không tự phát hành hóa đơn thật trong MISA hay app kế toán.",
    accountingPresetLabel: "Mẫu xuất",
    accountingPresetInvoice: "Hóa đơn phổ thông",
    accountingPresetCustom: "Mẫu riêng",
    accountingPresetMisa: "MISA cơ bản",
    accountingPresetUniversal: "Phổ thông",
    accountingDraftReady: "Bản nháp an toàn",
    accountingSafeNote: "RevenueFlow chỉ tạo dữ liệu nháp/import. Ứng dụng không tự phát hành hóa đơn thật.",
    copyInvoiceDraft: "Copy tóm tắt",
    copyAccountingRow: "Copy dòng kế toán",
    copyAccountingGuide: "Copy hướng dẫn cột",
    exportAccountingSample: "Xuất file mẫu",
    exportMisaCsv: "Xuất CSV MISA",
    exportAccountingCsv: "Xuất CSV kế toán",
    accountingConnectorLabel: "App kế toán",
    accountingConnectorCsv: "CSV / import thủ công",
    accountingConnectorMisa: "MISA",
    accountingConnectorQuickBooks: "QuickBooks",
    accountingConnectorXero: "Xero",
    accountingConnectorGeneric: "App kế toán khác",
    accountingConnectorUrlLabel: "Link app/import",
    accountingConnectorUrlPlaceholder: "Dán link app kế toán hoặc trang import",
    accountingConnectorNotesLabel: "Ghi chú",
    openAccountingConnector: "Mở app kế toán",
    accountingConnectorReady: "Đã lưu đích kế toán. RevenueFlow chỉ chuẩn bị dữ liệu import, không lưu mật khẩu.",
    accountingConnectorMissingUrl: "Chưa có link app kế toán. Có thể để trống nếu chỉ xuất CSV.",
    accountingConnectorOpened: "Đã mở app kế toán trong tab mới.",
    accountingConnectorOpenFailed: "Không mở được app kế toán.",
    accountingTemplateTitle: "Tự học mẫu xuất",
    accountingTemplateHelp: "Dán dòng tiêu đề cột hoặc text từ mẫu hóa đơn/import của app kế toán. RevenueFlow sẽ tự map dữ liệu payment vào các cột tìm được.",
    accountingTemplatePlaceholder: "Ví dụ: Invoice date, Customer name, Customer email, Item name, Total, Payment reference\nHoặc dán text mẫu hóa đơn có các nhãn như Họ tên người mua hàng, Tên hàng hóa dịch vụ, Thành tiền...",
    saveAccountingTemplate: "Lưu mẫu riêng",
    clearAccountingTemplate: "Xóa mẫu",
    accountingTemplateSaved: "Đã lưu mẫu xuất riêng.",
    accountingTemplateCleared: "Đã xóa mẫu xuất riêng.",
    accountingTemplateMissing: "Dán tiêu đề cột hoặc text mẫu trước.",
    accountingRowPlaceholder: "Dòng import sẽ hiện ở đây sau khi chọn payment.",
    invoiceDraftTitle: "Nháp hóa đơn",
    invoiceDraftCustomer: "Khách hàng",
    invoiceDraftEmail: "Email",
    invoiceDraftProduct: "Hàng hóa / dịch vụ",
    invoiceDraftAmountUsd: "Số tiền USD",
    invoiceDraftAmountVnd: "Thành tiền VND",
    invoiceDraftProvider: "Cổng thanh toán",
    invoiceDraftReference: "Mã tham chiếu",
    invoiceDraftInvoiceNo: "Số HĐ",
    invoiceDraftInvoiceDate: "Ngày HĐ",
    invoiceDraftNotes: "Ghi chú",
    invoiceDraftMissing: "Chọn payment để tạo nháp hóa đơn.",
    invoiceDraftCopied: "Đã copy nháp hóa đơn.",
    accountingGuideCopied: "Đã copy hướng dẫn cột.",
    accountingSampleExported: "Đã xuất file CSV mẫu.",
    misaCsvExported: "Đã xuất CSV hóa đơn.",
    accountingExportMarked: "Đã xuất file kế toán. Payment được đánh dấu đã xuất.",
    accountingCopied: "Đã copy dòng kế toán.",
    accountingCsvExported: "Đã xuất CSV kế toán.",
    productDeleted: "Đã xóa mục đang chọn.",
    productDeleteEmpty: "Hãy chọn một sản phẩm/dịch vụ để xóa.",
    productNameMissing: "Hãy nhập tên sản phẩm/dịch vụ.",
    productRuleTipTitle: "Muốn tự nhận diện sản phẩm chính xác hơn?",
    productRuleTipText: "Bạn có thể tạo rule sản phẩm trong Settings: nhập số tiền USD và tên sản phẩm/dịch vụ. Lần sau RevenueFlow sẽ tự gợi ý đúng hơn.",
    openProductRuleSettings: "Mở Product Rules",
    sheetTipTitle: "Bạn có thể đổi nơi lưu dữ liệu trong Settings",
    sheetTipText: "Nếu muốn đổi tab, ô bắt đầu hoặc kiểm tra quyền Sheet, hãy mở Google Sheet settings.",
    openSheetSettings: "Mở Sheet Settings",
    dontShowTipAgain: "Không hiện lại",
    simpleRuleNoteTitle: "Rule được giữ đơn giản cho người dùng.",
    simpleRuleNoteText: "Bạn chỉ cần bật/tắt nguồn thanh toán và quản lý sản phẩm/dịch vụ. Các phần kỹ thuật đã được ẩn.",
    rateLabel: "Tỷ giá USD/VND",
    invoiceNoLabel: "Số hóa đơn",
    invoiceDateLabel: "Ngày xuất HĐ",
    sheetUrlLabel: "Link Google Sheet",
    targetGmailAccountLabel: "Giới hạn Gmail (không bắt buộc)",
    targetGmailAccountHelp: "Để trống để đăng nhập Gmail bất kỳ. Chỉ nhập email nếu muốn khóa RevenueFlow vào đúng tài khoản đó.",
    sheetHelp: "Bấm nút xanh để lưu dữ liệu vào đúng Google Sheet. Sau khi lưu, RevenueFlow sẽ hiện đúng tab và ô đã ghi.",
    sheetAccountUsing: "Sheet sẽ được truy cập bằng tài khoản:",
    sheetAccountMissing: "Hãy kết nối Gmail trước để xác định tài khoản truy cập Sheet.",
    sheetQuickSettingsTitle: "Tùy chỉnh Sheet",
    sheetQuickSettingsHelp: "Link, tab, ô ghi và mã hóa đơn",
    sheetMovedTitle: "Tùy chỉnh Sheet nằm ở phần Lưu vào Sheet",
    sheetMovedHelp: "Mở hộp Tùy chỉnh Sheet bên ngoài để sửa link Sheet, tab, ô bắt đầu, hướng ghi và số hóa đơn nhanh hơn.",
    sheetNameLabel: "Tên tab Sheet",
    sheetStartCellLabel: "Ô bắt đầu",
    sheetDirectionLabel: "Hướng ghi",
    directionDown: "Xuống",
    directionUp: "Lên",
    connectGoogle: "Kết nối Google",
    googleReady: "",
    googleConnecting: "Đang mở cửa sổ cấp quyền Google...",
    googleConnected: "Đã kết nối Google Sheets.",
    googleConnectFailed: "Không kết nối được Google.",
    oauthLogConnected: "Kết nối thành công. RevenueFlow chỉ đọc payment email và ghi Sheet khi bạn yêu cầu.",
    oauthLogPermission: "Google chưa cấp quyền. Bấm Kết nối Gmail và chọn Cho phép.",
    oauthLogProfile: "Chrome chưa có tài khoản Google. Hãy đăng nhập hồ sơ Chrome rồi thử lại.",
    oauthLogConfig: "Bản extension chưa được kích hoạt OAuth đúng cách. Hãy gửi Extension ID cho quản trị viên.",
    oauthLogNetwork: "Không liên lạc được với Google. Kiểm tra mạng rồi thử lại.",
    oauthLogGeneric: "Không thể kết nối Gmail. Hãy ngắt kết nối, reload extension và thử lại.",
    googleSetupMissing: "Google Sheets chưa sẵn sàng. Vui lòng reload extension hoặc liên hệ người cài đặt.",
    googleAccessBlocked: "Tài khoản Google này chưa được cấp quyền dùng ứng dụng. Vui lòng liên hệ hỗ trợ để kích hoạt.",
    googlePermissionDenied: "Bạn chưa cấp quyền Google Sheets. Hãy bấm Kết nối Google và chọn Cho phép.",
    googleSignedOut: "Chrome chưa đăng nhập Google. Hãy đăng nhập Chrome rồi thử lại.",
    googleBadClient: "Bản cài đặt này chưa được liên kết với Google OAuth. Hãy gửi Extension ID bên dưới cho người quản trị để kích hoạt một lần.",
    oauthSetupTitle: "Cần kích hoạt kết nối Google",
    oauthSetupHelp: "Đây là lỗi cấu hình của bản phát hành, không phải lỗi mật khẩu Gmail. Người quản trị cần tạo OAuth Client loại Chrome Extension bằng đúng Extension ID này.",
    copyOAuthExtensionId: "Sao chép ID",
    oauthIdCopied: "Đã sao chép Extension ID.",
    googleTokenExpired: "Phiên Google đã hết hạn. Hãy bấm Connect Google lại.",
    googleConnectTimeout: "Google chưa phản hồi. Hãy đóng cửa sổ đăng nhập còn mở, reload extension rồi thử lại.",
    googleApiTimeout: "Google Sheets phản hồi quá lâu. Kiểm tra mạng rồi thử lại.",
    bridgeApiTimeout: "Gmail phản hồi quá lâu. Hãy thử lại sau.",
    googleUnexpectedResponse: "Google Sheets chưa trả phản hồi hợp lệ. Hãy reload extension, liên kết Google lại rồi thử tiếp.",
    googlePermissionRetrying: "Đang xin lại quyền Google Sheets...",
    googleSheetPermissionFailed: "Google đang từ chối quyền Sheet.",
    googleSheetAccessStillBlocked: "Đã xin lại quyền nhưng vẫn chưa truy cập được Sheet. Hãy bấm Liên kết Google bằng đúng tài khoản có quyền với file Sheet, hoặc chia sẻ Sheet cho tài khoản đó.",
    googleSheetNotFound: "Không tìm thấy Google Sheet hoặc tài khoản này chưa có quyền truy cập.",
    googleTesting: "Đang kiểm tra Google Sheet...",
    googleReconnecting: "Đang làm mới kết nối Google...",
    googleWriting: "Đang ghi vào Google Sheet...",
    googleWriteNotConfirmed: "Google chưa xác nhận kết quả ghi. Hãy mở Sheet kiểm tra dòng mới trước khi bấm Ghi lại.",
    googleBusy: "Google đang xử lý yêu cầu trước đó.",
    sheetTabMissing: "Không tìm thấy tab Sheet đã nhập.",
    invalidStartCell: "Ô bắt đầu chưa đúng. Ví dụ hợp lệ: A2.",
    copyAndWriteSuccess: "Đã copy và ghi vào Google Sheet.",
    copyAllAndWriteSuccess: "Đã copy và ghi tất cả vào Google Sheet.",
    autoCopyOff: "Đã tạo dòng. Tự copy đang tắt trong cấu hình.",
    vatLabel: "VAT %",
    paypalFeeLabel: "Phí cổng thanh toán %",
    autoCopyLabel: "Tự copy sau khi tạo dòng",
    strictValidationLabel: "Chặn copy nếu thiếu dữ liệu",
    appendAccountingLabel: "Thêm cột kế toán",
    autoIncrementInvoiceLabel: "Tự tăng số hóa đơn",
    autoWriteSheetLabel: "Tự ghi vào Google Sheet sau khi copy",
    appearanceTitle: "Cài đặt giao diện",
    resetAppearance: "Mặc định",
    fontFamilyLabel: "Font chữ",
    fontSizeLabel: "Cỡ chữ",
    primaryColorLabel: "Màu chính",
    panelColorLabel: "Màu khung",
    appearanceHelp: "Ẩn ở đây để luồng nhập liệu chính gọn hơn.",
    rulesTitle: "Rule nhận diện payment & sản phẩm",
    ruleSettingsIntro: "Bật cổng thanh toán cần quét, thêm rule sản phẩm theo số tiền, và chỉ dùng phần nâng cao khi cần provider mới.",
    providerRulesTitle: "Cổng thanh toán",
    providerRulesHelp: "Bật/tắt PayPal, Stripe hoặc nguồn thanh toán khác.",
    ruleModeLabel: "Cách nhận diện email",
    ruleModeDefault: "Dùng rule mặc định",
    ruleModeCustom: "Dùng rule của tôi",
    ruleModeHelp: "Mặc định phù hợp với PayPal, Stripe và các email thanh toán phổ biến. Chỉ đổi sang custom khi bạn muốn tự sửa rule quét.",
    saveGatewayRulesLabel: "Lưu cổng",
    productRulesTitle: "Sản phẩm theo số tiền",
    productRulesHelp: "Thêm, sửa hoặc xóa sản phẩm/dịch vụ để phù hợp với doanh nghiệp của bạn.",
    productAliasTitle: "Đổi tên sản phẩm tự động",
    productAliasHelp: "Nếu email có các từ khóa này, RevenueFlow sẽ ghi tên sản phẩm/dịch vụ theo tên bạn chọn.",
    productAliasKeywordsLabel: "Email có chữ",
    productAliasNameLabel: "Ghi thành",
    productAliasAdded: "Đã thêm rule đổi tên sản phẩm.",
    productAliasDeleted: "Đã xóa rule đổi tên sản phẩm.",
    productAliasMissing: "Nhập cả từ khóa và tên muốn ghi.",
    productAliasPresetApplied: "Đã thêm mẫu đổi tên phí recurring.",
    applyRecurringAliasPreset: "Dùng mẫu phí recurring",
    customRuleTitle: "Thêm nguồn thanh toán mới",
    customRuleHelp: "Dùng khi cần Paddle, Wise, ngân hàng hoặc email custom.",
    advancedCustomRuleTitle: "Nâng cao: thêm nguồn thanh toán mới",
    advancedCustomRuleHelp: "Chỉ mở khi nguồn thanh toán chưa có sẵn trong danh sách.",
    customGatewayNameLabel: "Tên nguồn",
    customEmailTypeLabel: "Loại email",
    customSenderDomainsLabel: "Tên miền gửi",
    customSearchKeywordsLabel: "Từ khóa tìm email",
    customIgnoreKeywordsLabel: "Từ khóa bỏ qua",
    customEmailTypeKeywordsLabel: "Từ khóa nhận diện loại",
    regexFieldsTitle: "Trường nâng cao / Regex",
    regexFieldsHelp: "Chỉ dành cho developer khi email có format khác.",
    customRevenueImpactLabel: "Ảnh hưởng doanh thu",
    customShouldWriteLabel: "Cho phép ghi vào Sheet doanh thu",
    addCustomRuleLabel: "Thêm rule",
    testCustomRuleLabel: "Test rule",
    sampleEmailLabel: "Dán email mẫu để test",
    advancedRuleJsonTitle: "Nâng cao: JSON rule",
    advancedRuleJsonHelp: "Chỉ sửa khi cần import/export hoặc debug.",
    resetGatewayRulesLabel: "Mặc định",
    exportGatewayRulesLabel: "Export",
    importGatewayRulesLabel: "Import",
    legacyRuleTitle: "Nguồn thanh toán kiểu cũ",
    legacyRuleHelp: "Giữ lại để tương thích với bản cũ.",
    saveRules: "Lưu rule",
    sourceRulesLabel: "Nguồn thanh toán",
    sourceRulesHelp: "Mỗi dòng: Tên nguồn | tên miền gửi | từ khóa, cách nhau bằng dấu phẩy.",
    sourceRulesPlaceholder: "Stripe|stripe.com|payment succeeded,invoice paid",
    productRulesLabel: "Sản phẩm theo số tiền",
    rulesHelp: "Tip: nhập số tiền USD nếu muốn RevenueFlow tự chọn sản phẩm theo amount. Có thể để trống USD nếu chỉ muốn thêm vào danh sách chọn.",
    emailBridgeTitle: "Trạng thái Gmail",
    enableEmailBridgeLabel: "Bật quét Gmail",
    bridgeUrlLabel: "Nguồn Gmail",
    bridgeStatusIdle: "Chưa kết nối nguồn",
    bridgeStatusReady: "Đã kết nối",
    bridgeStatusSyncing: "Đang đồng bộ",
    bridgeStatusImported: "Đã import",
    bridgeStatusDisabled: "Chưa bật quét",
    bridgeStatusError: "Cần kiểm tra Gmail",
    bridgeStatusReview: "Cần kiểm tra",
    bridgeStatusBlocked: "Bị chặn",
    bridgeServiceStateLabel: "Trạng thái",
    bridgeLastSyncLabel: "Lần sync cuối",
    bridgeNextSyncLabel: "Lần sync tới",
    bridgeScannedLabel: "Đã quét",
    bridgeMatchedLabel: "Khớp",
    bridgeNeedReviewLabel: "Cần kiểm tra",
    bridgeDuplicateLabel: "Trùng",
    checkBridge: "Kiểm tra Gmail",
    syncEmailNow: "Quét email payment",
    importLatestPayment: "Dùng payment mới nhất",
    viewLatestRecords: "Xem payment",
    openBridgeSetup: "Kết nối Gmail",
    bridgeCheckSuccess: "Gmail đã sẵn sàng.",
    bridgeCheckFailed: "Chưa kết nối được Gmail. Hãy bấm Kết nối Gmail rồi thử lại.",
    bridgeSyncSuccess: "Đã quét email payment.",
    bridgeLatestEmpty: "Chưa tìm thấy payment phù hợp trong Gmail.",
    bridgeImportSuccess: "Đã đưa payment mới nhất vào form kiểm tra.",
    sheetRowTitle: "Lưu vào Sheet",
    copy: "Sao chép",
    writeSheet: "Lưu vào Sheet",
    testSheet: "Kiểm tra Sheet",
    copyAll: "Copy tất cả",
    openSheet: "Mở Sheet",
    historyTitle: "Lịch sử",
    clear: "Xóa",
    productAuto: "Tự đoán theo số tiền",
    noHistory: "Chưa có lịch sử.",
    reliable: "chắc chắn",
    needsReview: "cần kiểm tra",
    ready: "Sẵn sàng. Bấm Bắt đầu xử lý payment để quét Gmail và lấy payment mới nhất.",
    gmailReadFailed: "Không đọc được nội dung Gmail. Hãy reload tab Gmail rồi thử lại.",
    sidePanelReady: "Sẵn sàng. Bấm Bắt đầu xử lý payment để quét Gmail.",
    rateSourceEmpty: "Tỷ giá sẽ tự cập nhật khi bạn dùng RevenueFlow. Nếu mạng lỗi, RevenueFlow giữ tỷ giá hiện tại.",
    datePlaceholder: "07/06/2026",
    emailTypePlaceholder: "Payment received",
    invoiceNoPlaceholder: "Điền vào đây",
    rulesPlaceholder: "Điền mỗi dòng một sản phẩm hoặc dạng 99=Tên sản phẩm",
    typeHerePlaceholder: "Điền vào đây",
    amountPlaceholder: "Số tiền",
    keywordPlaceholder: "Nhập từ khóa, cách nhau bằng dấu phẩy",
    domainPlaceholder: "Nhập tên miền gửi",
    sheetRowPlaceholder: "Dòng Sheet sẽ xuất hiện ở đây sau khi tạo.",
    aboutTitle: "Thông tin và bảo mật",
    providerFilterShort: "Cổng",
    emailTypeFilterShort: "Loại email",
    sheetFilterShort: "Sheet",
    sheetFilterAll: "Tất cả",
    sheetFilterWritten: "Đã ghi",
    sheetFilterNotWritten: "Chưa ghi",
    sheetFilterNotRevenue: "Không phải doanh thu",
    providerLabel: "Cổng thanh toán",
    statusLabel: "Trạng thái",
    revenueImpactLabel: "Ảnh hưởng doanh thu",
    allowRevenueWriteLabel: "Cho phép ghi bản ghi này vào Sheet doanh thu",
    googleSheetLabel: "Google Sheet",
    sheetTargetReady: "Sẵn sàng",
    sheetTargetConnected: "Đã kết nối: {sheetName} - ghi từ {startCell}",
    sheetTargetAutoCreate: "Chưa chọn Sheet - RevenueFlow sẽ tự tạo khi lưu lần đầu",
    sheetSecondarySummary: "Link Sheet và sao chép thủ công",
    sheetUrlPlaceholder: "RevenueFlow sẽ tự tạo Google Sheet khi lưu lần đầu",
    quickProductNamePlaceholder: "Thêm tên sản phẩm hoặc dịch vụ",
    manualLabel: "Nhập tay",
    unknownLabel: "Chưa rõ",
    willWriteSheet: "Sẽ ghi Sheet",
    notRevenue: "Không phải doanh thu",
    revenueImpactPositive: "Tăng doanh thu",
    revenueImpactNegative: "Giảm doanh thu",
    revenueImpactNone: "Không ảnh hưởng",
    revenueImpactRiskNegative: "Rủi ro giảm doanh thu",
    emailTypeAll: "Tất cả",
    emailTypePaid: "Đã thanh toán",
    emailTypeFailed: "Thanh toán lỗi",
    emailTypeRefund: "Hoàn tiền",
    emailTypeDispute: "Tranh chấp",
    emailTypeSubscription: "Subscription",
    emailTypeInfo: "Thông tin",
    recordStatusInfo: "Thông tin",
    recordStatusPaid: "Đã thanh toán",
    recordStatusRefund: "Hoàn tiền",
    recordStatusPending: "Đang chờ",
    recordStatusFailed: "Thất bại",
    recordStatusDispute: "Tranh chấp",
    canWriteAfterReview: "Bản ghi này có thể ghi sau khi bạn kiểm tra.",
    notSuccessfulPaymentReason: "Email này không phải thanh toán thành công. RevenueFlow sẽ không ghi vào Sheet doanh thu trừ khi bạn cho phép thủ công.",
    possibleDuplicateTransaction: "Có thể là giao dịch trùng",
    manualReviewOverrideReason: "Đã bật ghi sau khi kiểm tra thủ công. RevenueFlow vẫn kiểm tra các trường bắt buộc trước khi lưu.",
    notRevenueReason: "{status} / {type} mặc định không được ghi vào Sheet doanh thu.",
    noMatchedPaymentAfterScan: "Đã kiểm tra {checked} email liên quan, nhưng chưa email nào khớp rule payment đã cấu hình.",
    eventSuccessfulPayment: "Thanh toán thành công",
    eventRecurringPaymentSuccess: "Thanh toán subscription",
    eventInvoicePaid: "Hóa đơn đã thanh toán",
    eventRefund: "Hoàn tiền",
    eventPaymentFailed: "Thanh toán thất bại",
    eventDispute: "Tranh chấp",
    languageTitle: "Đổi ngôn ngữ",
    themeTitle: "Đổi giao diện"
  },
  en: {
    appTitle: "RevenueFlow Assistant",
    enableSheetsApiAdmin: "Administrator: Enable Google Sheets API once",
    googleSheetsApiDisabled: "Google Sheets API is not enabled for RevenueFlow. A Netbase administrator must enable it once; customers do not need to configure it.",
    googleSheetsScopeMissing: "RevenueFlow does not have Google Sheets permission. Click Save again and allow Google Sheets access.",
    privacyNoticeTitle: "Privacy:",
    privacyNoticeText: "RevenueFlow reads payment emails through Google OAuth. It never asks for or stores email passwords.",
    privacyNoticeLink: "View policy",
    appDesc: "Scan received payments from Gmail, review quickly, then save to Google Sheet.",
    quickStartEyebrow: "Dashboard",
    quickStartTitle: "Scan new payments",
    quickStartHelp: "Click the blue button. RevenueFlow finds payment emails and adds them to the list.",
    gmailAccountLabel: "Mailbox source being scanned",
    gmailAccountDisconnected: "Source is not connected",
    connectGmailAccount: "Connect Gmail",
    changeGmailAccount: "How to change account",
    accountSwitchHelp: "Chrome authorizes the account of the current browser profile. To use another Gmail account, switch to its Chrome profile, open RevenueFlow, then connect Gmail.",
    disconnectGmailAccount: "Disconnect current account",
    gmailDisconnected: "Gmail disconnected. Switch Chrome profiles to use another account.",
    gmailAccountConnected: "Gmail connected",
    gmailSourceHelp: "Source: this Gmail account through the Gmail API, not the email open in the browser.",
    workflowEyebrow: "Workflow",
    workflowTitle: "Work from top to bottom",
    workflowHelp: "No need to open emails manually. Scan Gmail, pick a received payment, review, then write.",
    stepSyncTitle: "Scan email",
    stepSyncHelp: "Scan Gmail without opening emails manually.",
    stepReviewTitle: "Review data",
    stepReviewHelp: "Edit name, email, order, and amount if needed.",
    stepWriteTitle: "Write Sheet",
    stepWriteHelp: "Copy or write directly to Google Sheet.",
    advancedBridgeSummary: "Gmail status",
    emailSyncTitle: "Get new payments",
    emailSyncBadge: "Main action",
    emailSyncHelp: "Click the button below to scan new emails and import the latest payment into the review form.",
    paymentInboxTitle: "Detected payments",
    dashboardTitle: "Summary",
    dashboardHelp: "Revenue is deduplicated across scanned payments and processing history.",
    monthRevenueLabel: "This month revenue",
    paymentCountLabel: "Payments",
    duplicateCountLabel: "Possible duplicates",
    exportCsv: "Export CSV",
    providerFilterLabel: "Filter by payment provider",
    providerAll: "All providers",
    inboxDuplicate: "Duplicate",
    reviewReady: "Ready to save",
    reviewReadyHelp: "Required details are complete. Review once more, then save to Sheet.",
    reviewBlocked: "Not ready to save",
    reviewDuplicateHelp: "This transaction may be duplicated. Check its Transaction ID before saving.",
    confirmDuplicate: "Reviewed, continue saving",
    reviewSelectPayment: "Select a payment to start reviewing.",
    paymentInboxHelp: "Select one row to review and save.",
    paymentInboxEmpty: "No payments yet. Start the payment workflow to scan Gmail.",
    inboxScanSummary: "Scanned {scanned} related emails · found {matched} payments",
    inboxSaved: "Saved to Sheet",
    inboxStatusColumn: "Status",
    inboxDateColumn: "Date",
    inboxCustomerColumn: "Customer",
    inboxReferenceColumn: "Reference",
    inboxAmountColumn: "USD",
    inboxTypeColumn: "Type",
    inboxReady: "OK",
    inboxReview: "Review",
    inboxNew: "New",
    smartFilterAll: "All",
    smartFilterReady: "Ready",
    smartFilterReview: "Review",
    smartFilterDuplicate: "Duplicate",
    smartFilterSaved: "Saved",
    smartInboxReadyHelp: "Ready to save",
    smartInboxSavedHelp: "Verified in Sheet",
    bulkReadyLabel: "ready payments",
    bulkCopyReady: "Copy ready",
    bulkSaveReady: "Save ready to Sheet",
    bulkNoneReady: "There are no ready payments for bulk processing.",
    bulkCopiedReady: "Ready payments copied.",
    bulkSavedReady: "Ready payments saved to Sheet.",
    queueSummaryText: "Ready {ready} · Review {review} · Duplicate {duplicate} · Saved {saved}",
    queueNextSave: "Next: save ready payments to Sheet.",
    queueNextReview: "Next: open each payment that needs review.",
    queueNextDuplicate: "Next: check duplicate transactions before saving.",
    queueNextScan: "Next: scan Gmail for received payments.",
    queueNextDone: "Done: detected payments have been handled.",
    bulkSavedReadyDetailed: "Saved {saved} ready payments to Sheet. Skipped {skipped} payments that need review, are duplicate, or are already saved.",
    setupGmailStep: "Connect source",
    setupSheetStep: "Prepare Google Sheet",
    setupScanStep: "Scan payments",
    setupDone: "Done",
    setupMissing: "Needs setup",
    guidedGmailTitle: "Step 1: Connect payment source",
    guidedGmailHelp: "Connect Gmail with Google OAuth so RevenueFlow can fetch received payments. The extension never stores Gmail passwords.",
    guidedSheetTitle: "Step 2: Prepare Google Sheet",
    guidedSheetHelp: "Create a new Sheet or paste the Sheet link where revenue records should be saved.",
    guidedScanTitle: "Step 3: Scan the first payment",
    guidedScanHelp: "Scan Gmail to find received payment emails and add them to the review list.",
    guidedReadyTitle: "Ready to process payments",
    guidedReadyHelp: "Payment source and Sheet are ready. Click the blue button to scan new payments.",
    guidedDismiss: "Got it",
    createDefaultSheet: "Create RevenueFlow Sheet",
    defaultSheetCreated: "Created the RevenueFlow Sheet and added column headers.",
    quickFixConnectGmail: "Connect Gmail",
    quickFixCreateSheet: "Create new Sheet",
    quickFixOpenSettings: "Open Sheet settings",
    quickFixTryAgain: "Try again",
    reviewSummaryTitle: "Payment summary",
    reviewSummaryReady: "Ready to save",
    reviewSummaryNeedsReview: "Needs review",
    reviewSummarySaved: "Saved to Sheet",
    reviewSummaryDuplicate: "Possible duplicate",
    reviewAcceptTitle: "Reviewed OK, allow saving",
    reviewMoreTitle: "More actions",
    reviewAccepted: "Marked as reviewed. You can copy or save to Sheet.",
    clearCurrentPayment: "Clear this form",
    removeCurrentPayment: "Remove this payment",
    currentPaymentCleared: "Cleared the current form.",
    currentPaymentRemoved: "Removed the payment from the list.",
    demoPaymentLoaded: "Loaded a demo payment for UI review.",
    loadDemoPayment: "Try demo",
    sheetHealthTitle: "Sheet health",
    sheetHealthReady: "Sheet is ready",
    sheetHealthMissing: "No Sheet yet. RevenueFlow can create one automatically, or you can create it now.",
    sheetHealthNextCell: "Next cell",
    sheetHealthAccount: "Account",
    sheetMappingTitle: "Sheet columns",
    sheetMappingHelp: "Choose columns for the main fields. Keep the default if unsure.",
    sheetPresetStandard: "Standard preset",
    sheetPresetVietnam: "VN accounting preset",
    sheetPreviewTitle: "Preview before saving",
    sheetPreviewHelp: "Click a column letter to change where it writes.",
    sheetPreviewEditHint: "Click a column letter to change where it writes.",
    sheetColumnPrompt: "Enter Sheet column for {field}",
    sheetColumnUpdated: "Moved {field} to column {column}.",
    sheetColumnInvalid: "Invalid Sheet column. Example: B, C, AA.",
    sheetPreflightTitle: "Check before saving",
    sheetPreflightMissing: "Missing: {fields}",
    sheetPreflightDuplicate: "This may be a duplicate transaction. Review it before saving.",
    sheetPreflightNoSheet: "No Sheet link yet. RevenueFlow will create a private Sheet when you save.",
    sheetPreflightColumnBeforeStart: "Some columns are before the start cell. RevenueFlow will use a safe default column.",
    sheetVerifiedTitle: "Written and verified",
    sheetVerifiedHelp: "RevenueFlow read the Google Sheet again to confirm the data is there.",
    sheetVerifiedRange: "Location",
    sheetVerifiedTime: "Verified at",
    sheetVerifiedOpen: "Open saved row",
    sheetColumnDate: "Date",
    sheetColumnCustomer: "Customer",
    sheetColumnReference: "Reference",
    sheetColumnProduct: "Product",
    sheetColumnUsd: "USD",
    sheetColumnProvider: "Provider",
    sheetColumnVnd: "VND",
    sheetColumnRate: "Rate",
    sheetColumnInvoiceNo: "Invoice no.",
    sheetColumnInvoiceDate: "Invoice date",
    paymentDetailTitle: "Payment detail",
    paymentDetailReason: "Review reason",
    paymentDetailSource: "Email source",
    paymentDetailRaw: "Subject",
    applyRecommendedPresets: "Use recommended presets",
    presetsApplied: "Enabled common presets for PayPal, Stripe, Paddle, WooCommerce, Shopify, and bank transfer.",
    backupSettingsTitle: "Backup & transfer",
    backupSettingsHelp: "Export settings to move to another Chrome profile or computer. The file never contains a Gmail password.",
    exportSettings: "Export settings",
    importSettings: "Import settings",
    settingsExported: "RevenueFlow settings exported.",
    settingsImported: "Settings imported. Check Gmail and Sheet before saving data.",
    manualGmailTitle: "Legacy mode: read the email open in Gmail",
    manualGmailHelp: "This mode is hidden in the global build. Gmail Sync scans email automatically.",
    primaryAction: "Build row from Gmail",
    buildOnly: "Build only",
    forceCopy: "Copy anyway",
    extractedTitle: "Review payment",
    extractedHelp: "Edit details only if needed.",
    settingsTitle: "Settings",
    settingsEyebrow: "Setup",
    settingsSubtitle: "Only adjust what you need. Most users only need Google Sheet and payment rules.",
    setupCardGoogleTitle: "Google connection",
    setupCardGoogleHelp: "Used for Gmail scan and Sheet write.",
    setupCardSheetTitle: "Google Sheet",
    setupCardSheetHelp: "Choose the tab and start cell.",
    setupCardRulesTitle: "Rules",
    setupCardRulesHelp: "Enable payment providers and map products.",
    settingsToggleTitle: "Open settings",
    rateSettingsTitle: "Rate & invoice",
    rateSettingsHelp: "RevenueFlow auto-updates the rate while you use the extension. Click Refresh rate to load the latest rate now.",
    liveRateLabel: "USD/VND rate",
    refreshRateNow: "Refresh",
    rateUpdatingShort: "updating",
    rateManualFallbackShort: "using saved rate",
    rateLiveShort: "auto-updated",
    sheetSettingsTitle: "Google Sheet",
    behaviorSettingsTitle: "Automation & safety",
    behaviorSettingsHelp: "Keep the defaults if unsure. These options control when RevenueFlow may copy or write data.",
    saveSettings: "Save",
    getRate: "Refresh rate",
    dateLabel: "Date",
    emailTypeLabel: "Email type",
    customerLabel: "Customer",
    emailLabel: "Email",
    referenceLabel: "Order / Reference",
    usdLabel: "USD",
    transactionLabel: "Transaction ID",
    profileLabel: "Profile ID",
    productLabel: "Product / service",
    addProduct: "Add item",
    deleteSelectedProduct: "Delete selected",
    undoProductChange: "Undo",
    productUndoDone: "Product change undone.",
    productUndoEmpty: "There is no product change to undo.",
    accountingAdvancedTitle: "Advanced: VAT / provider fee",
    accountingAdvancedHelp: "Used only when accounting columns are enabled. It does not affect the basic Sheet row.",
    productAmountLabel: "USD (optional)",
    productNameLabel: "Product / service name",
    productAdded: "Product/service item added.",
    customFieldsTitle: "Email details",
    writeCustomFieldsLabel: "Write selected details",
    customFieldsSheetColumnLabel: "Column",
    customFieldsSheetColumnHelp: "Only details marked Write to Sheet are written into this column.",
    addCustomFieldTitle: "Add detail",
    customFieldsCount: "{count} details",
    customFieldWriteOn: "Write",
    customFieldWriteOff: "Skip",
    sheetFieldWriteOn: "Write",
    sheetFieldWriteOff: "Skip",
    customFieldNamePlaceholder: "Field name",
    customFieldValuePlaceholder: "Value",
    accountingHandoffTitle: "Accounting app data",
    accountingHandoffHelp: "Export CSV/import data from the reviewed payment. RevenueFlow does not issue real invoices inside MISA or accounting apps.",
    accountingPresetLabel: "Export template",
    accountingPresetInvoice: "Standard invoice",
    accountingPresetCustom: "Custom template",
    accountingPresetMisa: "MISA basic",
    accountingPresetUniversal: "Universal",
    accountingDraftReady: "Safe draft",
    accountingSafeNote: "RevenueFlow only prepares draft/import data. It never issues real invoices automatically.",
    copyInvoiceDraft: "Copy summary",
    copyAccountingRow: "Copy accounting row",
    copyAccountingGuide: "Copy field guide",
    exportAccountingSample: "Export sample",
    exportMisaCsv: "Export MISA CSV",
    exportAccountingCsv: "Export accounting CSV",
    accountingConnectorLabel: "Accounting app",
    accountingConnectorCsv: "CSV / manual import",
    accountingConnectorMisa: "MISA",
    accountingConnectorQuickBooks: "QuickBooks",
    accountingConnectorXero: "Xero",
    accountingConnectorGeneric: "Other accounting app",
    accountingConnectorUrlLabel: "App/import link",
    accountingConnectorUrlPlaceholder: "Paste accounting app or import page link",
    accountingConnectorNotesLabel: "Notes",
    openAccountingConnector: "Open accounting app",
    accountingConnectorReady: "Accounting destination saved. RevenueFlow prepares import data only and never stores passwords.",
    accountingConnectorMissingUrl: "No accounting app link yet. You can leave this blank when exporting CSV only.",
    accountingConnectorOpened: "Accounting app opened in a new tab.",
    accountingConnectorOpenFailed: "Could not open accounting app.",
    accountingTemplateTitle: "Learn export template",
    accountingTemplateHelp: "Paste a header row or text from an invoice/import sample. RevenueFlow maps payment data into the columns it finds.",
    accountingTemplatePlaceholder: "Example: Invoice date, Customer name, Customer email, Item name, Total, Payment reference\nOr paste invoice text with labels such as Buyer, Product/service, Total amount...",
    saveAccountingTemplate: "Save template",
    clearAccountingTemplate: "Clear template",
    accountingTemplateSaved: "Custom export template saved.",
    accountingTemplateCleared: "Custom export template cleared.",
    accountingTemplateMissing: "Paste column headers or sample text first.",
    accountingRowPlaceholder: "Import row will appear here after selecting a payment.",
    invoiceDraftTitle: "Invoice draft",
    invoiceDraftCustomer: "Customer",
    invoiceDraftEmail: "Email",
    invoiceDraftProduct: "Product / service",
    invoiceDraftAmountUsd: "Amount USD",
    invoiceDraftAmountVnd: "Amount VND",
    invoiceDraftProvider: "Payment provider",
    invoiceDraftReference: "Reference",
    invoiceDraftInvoiceNo: "Invoice no.",
    invoiceDraftInvoiceDate: "Invoice date",
    invoiceDraftNotes: "Notes",
    invoiceDraftMissing: "Select a payment to create an invoice draft.",
    invoiceDraftCopied: "Invoice draft copied.",
    accountingGuideCopied: "Field guide copied.",
    accountingSampleExported: "Sample CSV exported.",
    misaCsvExported: "Invoice CSV exported.",
    accountingExportMarked: "Accounting file exported. Payment marked as exported.",
    accountingCopied: "Accounting row copied.",
    accountingCsvExported: "Accounting CSV exported.",
    productDeleted: "Selected item deleted.",
    productDeleteEmpty: "Select a product/service item to delete.",
    productNameMissing: "Enter a product/service name.",
    productRuleTipTitle: "Want better product auto-detection?",
    productRuleTipText: "Create a product rule in Settings: add a USD amount and a product/service name. RevenueFlow will suggest the right product next time.",
    openProductRuleSettings: "Open Product Rules",
    sheetTipTitle: "You can change where records are saved in Settings",
    sheetTipText: "Change the Sheet tab, start cell, or check Sheet access in Google Sheet settings.",
    openSheetSettings: "Open Sheet Settings",
    dontShowTipAgain: "Don't show again",
    simpleRuleNoteTitle: "Rules are simplified for everyday users.",
    simpleRuleNoteText: "You only need to enable payment sources and manage products/services. Technical fields are hidden.",
    rateLabel: "USD/VND rate",
    invoiceNoLabel: "Invoice no.",
    invoiceDateLabel: "Invoice date",
    sheetUrlLabel: "Google Sheet link",
    targetGmailAccountLabel: "Restrict Gmail account (optional)",
    targetGmailAccountHelp: "Leave blank to connect any Gmail account. Enter an address only to prevent accidental account selection.",
    sheetHelp: "Click the blue button to save data to the correct Google Sheet. After saving, RevenueFlow shows the exact tab and range.",
    sheetAccountUsing: "The Sheet will be accessed using:",
    sheetAccountMissing: "Connect Gmail first to identify the account used for Sheets.",
    sheetQuickSettingsTitle: "Sheet options",
    sheetQuickSettingsHelp: "Link, tab, start cell, and invoice",
    sheetMovedTitle: "Sheet options are beside Save to Sheet",
    sheetMovedHelp: "Open the compact Sheet options box outside Settings to edit the Sheet link, tab, start cell, write direction, and invoice fields faster.",
    sheetNameLabel: "Sheet tab name",
    sheetStartCellLabel: "Start cell",
    sheetDirectionLabel: "Write direction",
    directionDown: "Down",
    directionUp: "Up",
    connectGoogle: "Connect Google",
    googleReady: "",
    googleConnecting: "Opening Google permission window...",
    googleConnected: "Google Sheets is connected.",
    googleConnectFailed: "Google connection failed.",
    oauthLogConnected: "Connected. RevenueFlow only reads payment emails and writes to Sheets when requested.",
    oauthLogPermission: "Google permission was not granted. Connect Gmail and choose Allow.",
    oauthLogProfile: "No Google account is signed into this Chrome profile. Sign in, then try again.",
    oauthLogConfig: "OAuth is not activated for this extension build. Send the Extension ID to the administrator.",
    oauthLogNetwork: "Google could not be reached. Check your connection and try again.",
    oauthLogGeneric: "Gmail could not be connected. Disconnect, reload the extension, and try again.",
    googleSetupMissing: "Google Sheets is not ready. Reload the extension or contact the installer.",
    googleAccessBlocked: "This Google account has not been approved for the app. Contact support to activate access.",
    googlePermissionDenied: "Google Sheets permission was not approved. Click Connect Google and choose Allow.",
    googleSignedOut: "Chrome is not signed in to Google. Sign in to Chrome, then try again.",
    googleBadClient: "This build is not linked to Google OAuth yet. Send the Extension ID below to the administrator for one-time activation.",
    oauthSetupTitle: "Google connection activation required",
    oauthSetupHelp: "This is a release configuration issue, not a Gmail password issue. The administrator must create a Chrome Extension OAuth client for this exact Extension ID.",
    copyOAuthExtensionId: "Copy ID",
    oauthIdCopied: "Extension ID copied.",
    googleTokenExpired: "The Google session expired. Click Connect Google again.",
    googleConnectTimeout: "Google did not respond. Close any open sign-in window, reload the extension, and try again.",
    googleApiTimeout: "Google Sheets took too long to respond. Check the connection and try again.",
    bridgeApiTimeout: "Gmail took too long to respond. Try again later.",
    googleUnexpectedResponse: "Google Sheets returned an invalid response. Reload the extension, reconnect Google, and try again.",
    googlePermissionRetrying: "Requesting Google Sheets permission again...",
    googleSheetPermissionFailed: "Google is blocking Sheet access.",
    googleSheetAccessStillBlocked: "Permission was requested again, but the Sheet is still blocked. Connect the Google account that can access this Sheet, or share the Sheet with that account.",
    googleSheetNotFound: "The Google Sheet was not found or this account cannot access it.",
    googleTesting: "Checking Google Sheet...",
    googleReconnecting: "Refreshing Google connection...",
    googleWriting: "Writing to Google Sheet...",
    googleWriteNotConfirmed: "Google did not confirm the write. Open the Sheet and check the new row before writing again.",
    googleBusy: "Google is still processing the previous request.",
    sheetTabMissing: "The Sheet tab was not found.",
    invalidStartCell: "The start cell is invalid. Example: A2.",
    copyAndWriteSuccess: "Copied and wrote to Google Sheet.",
    copyAllAndWriteSuccess: "Copied and wrote all rows to Google Sheet.",
    autoCopyOff: "Row built. Auto-copy is turned off in settings.",
    vatLabel: "VAT %",
    paypalFeeLabel: "Payment provider fee %",
    autoCopyLabel: "Auto-copy after building a row",
    strictValidationLabel: "Block copy when data is missing",
    appendAccountingLabel: "Append accounting columns",
    autoIncrementInvoiceLabel: "Auto-increment invoice number",
    autoWriteSheetLabel: "Auto-write to Google Sheet after copy",
    appearanceTitle: "Appearance settings",
    resetAppearance: "Reset",
    fontFamilyLabel: "Font",
    fontSizeLabel: "Font size",
    primaryColorLabel: "Primary color",
    panelColorLabel: "Panel color",
    appearanceHelp: "Kept here so the main workflow stays focused.",
    rulesTitle: "Payment & product rules",
    ruleSettingsIntro: "Enable payment providers, map products by amount, and use advanced tools only when adding a new provider.",
    providerRulesTitle: "Payment providers",
    providerRulesHelp: "Turn PayPal, Stripe, or other payment sources on or off.",
    ruleModeLabel: "Email detection mode",
    ruleModeDefault: "Use built-in rules",
    ruleModeCustom: "Use my custom rules",
    ruleModeHelp: "Built-in rules cover common PayPal, Stripe, and payment emails. Switch to custom only when you want to edit scan rules.",
    saveGatewayRulesLabel: "Save providers",
    productRulesTitle: "Products by amount",
    productRulesHelp: "Add, edit, or remove products/services so this extension fits your business.",
    productAliasTitle: "Automatic product renaming",
    productAliasHelp: "If the email contains these keywords, RevenueFlow writes the product/service name you choose.",
    productAliasKeywordsLabel: "Email contains",
    productAliasNameLabel: "Write as",
    productAliasAdded: "Product rename rule added.",
    productAliasDeleted: "Product rename rule deleted.",
    productAliasMissing: "Enter both keywords and the product name to write.",
    productAliasPresetApplied: "Recurring-fee rename preset added.",
    applyRecurringAliasPreset: "Use recurring fee preset",
    customRuleTitle: "Add a new payment source",
    customRuleHelp: "Use this for Paddle, Wise, bank transfer, or custom emails.",
    advancedCustomRuleTitle: "Advanced: add a new payment source",
    advancedCustomRuleHelp: "Open only when the payment source is not already listed.",
    customGatewayNameLabel: "Source name",
    customEmailTypeLabel: "Email type",
    customSenderDomainsLabel: "Sender domains",
    customSearchKeywordsLabel: "Search keywords",
    customIgnoreKeywordsLabel: "Ignore keywords",
    customEmailTypeKeywordsLabel: "Type keywords",
    regexFieldsTitle: "Advanced fields / Regex",
    regexFieldsHelp: "Developer-only, for unusual email formats.",
    customRevenueImpactLabel: "Revenue impact",
    customShouldWriteLabel: "Allow writing to revenue Sheet",
    addCustomRuleLabel: "Add rule",
    testCustomRuleLabel: "Test rule",
    sampleEmailLabel: "Paste sample email to test",
    advancedRuleJsonTitle: "Advanced: rule JSON",
    advancedRuleJsonHelp: "Use only for import/export or debugging.",
    resetGatewayRulesLabel: "Reset",
    exportGatewayRulesLabel: "Export",
    importGatewayRulesLabel: "Import",
    legacyRuleTitle: "Legacy payment sources",
    legacyRuleHelp: "Kept for compatibility with older builds.",
    saveRules: "Save rules",
    sourceRulesLabel: "Payment sources",
    sourceRulesHelp: "One per line: Provider | sender domains | keywords, separated by commas.",
    sourceRulesPlaceholder: "Stripe|stripe.com|payment succeeded,invoice paid",
    productRulesLabel: "Products by amount",
    rulesHelp: "Tip: enter a USD amount when you want RevenueFlow to auto-select a product by amount. Leave USD blank to add a selectable item only.",
    emailBridgeTitle: "Gmail status",
    enableEmailBridgeLabel: "Enable Gmail scan",
    bridgeUrlLabel: "Gmail source",
    bridgeStatusIdle: "Source not connected",
    bridgeStatusReady: "Connected",
    bridgeStatusSyncing: "Syncing",
    bridgeStatusImported: "Imported",
    bridgeStatusDisabled: "Scan disabled",
    bridgeStatusError: "Check Gmail",
    bridgeStatusReview: "Needs review",
    bridgeStatusBlocked: "Blocked",
    bridgeServiceStateLabel: "State",
    bridgeLastSyncLabel: "Last sync",
    bridgeNextSyncLabel: "Next sync",
    bridgeScannedLabel: "Scanned",
    bridgeMatchedLabel: "Matched",
    bridgeNeedReviewLabel: "Need review",
    bridgeDuplicateLabel: "Duplicate",
    checkBridge: "Check Gmail",
    syncEmailNow: "Scan payment email",
    importLatestPayment: "Use latest payment",
    viewLatestRecords: "View payments",
    openBridgeSetup: "Connect Gmail",
    bridgeCheckSuccess: "Email Sync is ready.",
    bridgeCheckFailed: "Could not connect to Gmail. Click Connect Gmail, then try again.",
    bridgeSyncSuccess: "Gmail payment scan finished.",
    bridgeLatestEmpty: "No matching payment is available in Gmail yet.",
    bridgeImportSuccess: "Latest payment imported into the review form.",
    sheetRowTitle: "Save to Sheet",
    copy: "Copy",
    writeSheet: "Save to Sheet",
    testSheet: "Check Sheet",
    copyAll: "Copy all",
    openSheet: "Open Sheet",
    historyTitle: "History",
    clear: "Clear",
    productAuto: "Auto-detect by amount",
    noHistory: "No history yet.",
    reliable: "reliable",
    needsReview: "needs review",
    ready: "Ready. Start the payment workflow to scan Gmail and import the latest payment.",
    gmailReadFailed: "Could not read Gmail content. Reload the Gmail tab, then try again.",
    sidePanelReady: "Ready. Start the payment workflow to scan Gmail.",
    rateSourceEmpty: "Rate auto-updates while you use RevenueFlow. If the network fails, RevenueFlow keeps the current rate.",
    datePlaceholder: "07/06/2026",
    emailTypePlaceholder: "Payment received",
    invoiceNoPlaceholder: "Type here",
    rulesPlaceholder: "One product per line, or 99=Product name",
    typeHerePlaceholder: "Type here",
    amountPlaceholder: "Amount",
    keywordPlaceholder: "Type keywords, separated by commas",
    domainPlaceholder: "Type sender domains",
    sheetRowPlaceholder: "The Sheet row will appear here after it is built.",
    aboutTitle: "About and privacy",
    providerFilterShort: "Provider",
    emailTypeFilterShort: "Email type",
    sheetFilterShort: "Sheet",
    sheetFilterAll: "All",
    sheetFilterWritten: "Written",
    sheetFilterNotWritten: "Not written",
    sheetFilterNotRevenue: "Not revenue",
    providerLabel: "Provider",
    statusLabel: "Status",
    revenueImpactLabel: "Revenue impact",
    allowRevenueWriteLabel: "Allow writing this record to the revenue Sheet",
    googleSheetLabel: "Google Sheet",
    sheetTargetReady: "Ready",
    sheetTargetConnected: "Connected: {sheetName} - writes from {startCell}",
    sheetTargetAutoCreate: "No Sheet selected - RevenueFlow will create one on first save",
    sheetSecondarySummary: "Sheet link and manual copy",
    sheetUrlPlaceholder: "RevenueFlow will create a Google Sheet on first save",
    quickProductNamePlaceholder: "Add product or service name",
    manualLabel: "Manual",
    unknownLabel: "Unknown",
    willWriteSheet: "Will write Sheet",
    notRevenue: "Not revenue",
    revenueImpactPositive: "Positive revenue",
    revenueImpactNegative: "Negative revenue",
    revenueImpactNone: "No revenue impact",
    revenueImpactRiskNegative: "Risk / possible negative revenue",
    emailTypeAll: "All",
    emailTypePaid: "Paid",
    emailTypeFailed: "Failed",
    emailTypeRefund: "Refund",
    emailTypeDispute: "Dispute",
    emailTypeSubscription: "Subscription",
    emailTypeInfo: "Info",
    recordStatusInfo: "Info",
    recordStatusPaid: "Paid",
    recordStatusRefund: "Refund",
    recordStatusPending: "Pending",
    recordStatusFailed: "Failed",
    recordStatusDispute: "Dispute",
    canWriteAfterReview: "This record can be written after review.",
    notSuccessfulPaymentReason: "This email is not a successful payment. RevenueFlow will not write it to the revenue Sheet unless you manually allow it.",
    possibleDuplicateTransaction: "Possible duplicate transaction",
    manualReviewOverrideReason: "Manual review override is enabled. RevenueFlow still checks required fields before saving.",
    notRevenueReason: "{status} / {type} is not written to the revenue Sheet by default.",
    noMatchedPaymentAfterScan: "Checked {checked} related email(s), but none matched the configured payment rules.",
    eventSuccessfulPayment: "Successful payment",
    eventRecurringPaymentSuccess: "Subscription payment",
    eventInvoicePaid: "Invoice paid",
    eventRefund: "Refund",
    eventPaymentFailed: "Failed payment",
    eventDispute: "Dispute",
    languageTitle: "Change language",
    themeTitle: "Change theme"
  }
};

function t(key) {
  const lang = labels[config.language] ? config.language : "vi";
  if (Object.prototype.hasOwnProperty.call(labels[lang], key)) return labels[lang][key];
  if (Object.prototype.hasOwnProperty.call(labels.vi, key)) return labels.vi[key];
  return key;
}

function tf(key, values = {}) {
  return t(key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
}

const el = {
  appVersion: document.getElementById("appVersion"),
  oauthSetupCard: document.getElementById("oauthSetupCard"),
  oauthExtensionId: document.getElementById("oauthExtensionId"),
  copyOAuthExtensionId: document.getElementById("copyOAuthExtensionId"),
  quickFixActions: document.getElementById("quickFixActions"),
  setupGmailState: document.getElementById("setupGmailState"),
  setupSheetState: document.getElementById("setupSheetState"),
  setupScanState: document.getElementById("setupScanState"),
  setupConnectGmail: document.getElementById("setupConnectGmail"),
  setupCreateSheet: document.getElementById("setupCreateSheet"),
  setupScanPayments: document.getElementById("setupScanPayments"),
  loadDemoPayment: document.getElementById("loadDemoPayment"),
  autoRun: document.getElementById("autoRun"),
  buildOnly: document.getElementById("buildOnly"),
  forceCopy: document.getElementById("forceCopy"),
  quickSyncBridge: document.getElementById("quickSyncBridge"),
  gmailAccountEmail: document.getElementById("gmailAccountEmail"),
  connectGmailAccount: document.getElementById("connectGmailAccount"),
  disconnectGmailAccount: document.getElementById("disconnectGmailAccount"),
  accountSwitchHelp: document.getElementById("accountSwitchHelp"),
  quickImportBridgePayment: document.getElementById("quickImportBridgePayment"),
  quickCheckBridge: document.getElementById("quickCheckBridge"),
  quickViewBridgeRecords: document.getElementById("quickViewBridgeRecords"),
  quickOpenBridgeSetup: document.getElementById("quickOpenBridgeSetup"),
  quickRefreshRate: document.getElementById("quickRefreshRate"),
  liveRateValue: document.getElementById("liveRateValue"),
  liveRateStatus: document.getElementById("liveRateStatus"),
  productRuleSuggestion: document.getElementById("productRuleSuggestion"),
  openProductRulesSettings: document.getElementById("openProductRulesSettings"),
  dismissProductRuleTip: document.getElementById("dismissProductRuleTip"),
  sheetSettingsSuggestion: document.getElementById("sheetSettingsSuggestion"),
  openSheetSettingsTip: document.getElementById("openSheetSettingsTip"),
  dismissSheetTip: document.getElementById("dismissSheetTip"),
  paymentInboxCount: document.getElementById("paymentInboxCount"),
  dashboardExportCsv: document.getElementById("dashboardExportCsv"),
  monthRevenue: document.getElementById("monthRevenue"),
  dashboardPaymentCount: document.getElementById("dashboardPaymentCount"),
  dashboardDuplicateCount: document.getElementById("dashboardDuplicateCount"),
  revenueChart: document.getElementById("revenueChart"),
  providerFilter: document.getElementById("providerFilter"),
  emailTypeFilter: document.getElementById("emailTypeFilter"),
  sheetStatusFilter: document.getElementById("sheetStatusFilter"),
  smartInboxFilters: document.querySelector(".smart-inbox-filters"),
  paymentInboxScanSummary: document.getElementById("paymentInboxScanSummary"),
  bulkReadyBar: document.getElementById("bulkReadyBar"),
  bulkReadyCount: document.getElementById("bulkReadyCount"),
  bulkQueueSummary: document.getElementById("bulkQueueSummary"),
  bulkCopyReady: document.getElementById("bulkCopyReady"),
  bulkSaveReady: document.getElementById("bulkSaveReady"),
  paymentInboxBody: document.getElementById("paymentInboxBody"),
  paymentInboxEmpty: document.getElementById("paymentInboxEmpty"),
  paymentDetailCard: document.getElementById("paymentDetailCard"),
  getRate: document.getElementById("getRate"),
  saveSettings: document.getElementById("saveSettings"),
  saveRules: document.getElementById("saveRules"),
  resetAppearance: document.getElementById("resetAppearance"),
  copyRow: document.getElementById("copyRow"),
  writeSheet: document.getElementById("writeSheet"),
  accountingPreset: document.getElementById("accountingPreset"),
  accountingDraftStatus: document.getElementById("accountingDraftStatus"),
  accountingConnector: document.getElementById("accountingConnector"),
  accountingConnectorUrl: document.getElementById("accountingConnectorUrl"),
  accountingConnectorNotes: document.getElementById("accountingConnectorNotes"),
  accountingConnectorStatus: document.getElementById("accountingConnectorStatus"),
  openAccountingConnector: document.getElementById("openAccountingConnector"),
  accountingTemplateText: document.getElementById("accountingTemplateText"),
  saveAccountingTemplate: document.getElementById("saveAccountingTemplate"),
  clearAccountingTemplate: document.getElementById("clearAccountingTemplate"),
  invoiceDraftPreview: document.getElementById("invoiceDraftPreview"),
  copyInvoiceDraft: document.getElementById("copyInvoiceDraft"),
  copyAccountingRow: document.getElementById("copyAccountingRow"),
  copyAccountingGuide: document.getElementById("copyAccountingGuide"),
  exportAccountingSample: document.getElementById("exportAccountingSample"),
  exportMisaCsv: document.getElementById("exportMisaCsv"),
  exportAccountingCsv: document.getElementById("exportAccountingCsv"),
  accountingRowPreview: document.getElementById("accountingRowPreview"),
  testSheet: document.getElementById("testSheet"),
  connectGoogle: document.getElementById("connectGoogle"),
  copyAllRows: document.getElementById("copyAllRows"),
  openSheet: document.getElementById("openSheet"),
  exportCsv: document.getElementById("exportCsv"),
  clearHistory: document.getElementById("clearHistory"),
  settingsToggle: document.getElementById("settingsToggle"),
  settingsPanel: document.getElementById("settingsPanel"),
  languageToggle: document.getElementById("languageToggle"),
  themeToggle: document.getElementById("themeToggle"),
  status: document.getElementById("status"),
  guidedSetupCard: document.getElementById("guidedSetupCard"),
  guidedSetupStep: document.getElementById("guidedSetupStep"),
  guidedSetupTitle: document.getElementById("guidedSetupTitle"),
  guidedSetupHelp: document.getElementById("guidedSetupHelp"),
  guidedSetupAction: document.getElementById("guidedSetupAction"),
  warnings: document.getElementById("warnings"),
  reviewReadiness: document.getElementById("reviewReadiness"),
  reviewSummaryCard: document.getElementById("reviewSummaryCard"),
  reviewAccept: document.getElementById("reviewAccept"),
  reviewMore: document.getElementById("reviewMore"),
  reviewMoreMenu: document.getElementById("reviewMoreMenu"),
  clearCurrentPayment: document.getElementById("clearCurrentPayment"),
  removeCurrentPayment: document.getElementById("removeCurrentPayment"),
  reviewProvider: document.getElementById("reviewProvider"),
  reviewEmailType: document.getElementById("reviewEmailType"),
  reviewStatus: document.getElementById("reviewStatus"),
  reviewRevenueImpact: document.getElementById("reviewRevenueImpact"),
  addCustomField: document.getElementById("addCustomField"),
  customFieldsList: document.getElementById("customFieldsList"),
  customFieldsCount: document.getElementById("customFieldsCount"),
  writeCustomFields: document.getElementById("writeCustomFields"),
  customFieldsSheetColumn: document.getElementById("customFieldsSheetColumn"),
  sheetPreflightWarnings: document.getElementById("sheetPreflightWarnings"),
  sheetPreviewTable: document.getElementById("sheetPreviewTable"),
  applyStandardSheetPreset: document.getElementById("applyStandardSheetPreset"),
  applyVietnamSheetPreset: document.getElementById("applyVietnamSheetPreset"),
  sheetColumnInputs: {
    date: document.getElementById("sheetColDate"),
    customerName: document.getElementById("sheetColCustomerName"),
    orderNo: document.getElementById("sheetColOrderNo"),
    product: document.getElementById("sheetColProduct"),
    usd: document.getElementById("sheetColUsd"),
    provider: document.getElementById("sheetColProvider"),
    grossVnd: document.getElementById("sheetColGrossVnd"),
    rate: document.getElementById("sheetColRate"),
    invoiceNo: document.getElementById("sheetColInvoiceNo"),
    invoiceDate: document.getElementById("sheetColInvoiceDate")
  },
  shouldWriteRevenue: document.getElementById("shouldWriteRevenue"),
  revenueWriteReason: document.getElementById("revenueWriteReason"),
  oauthUserLog: document.getElementById("oauthUserLog"),
  confidenceBadge: document.getElementById("confidenceBadge"),
  confidenceList: document.getElementById("confidenceList"),
  recordSelect: document.getElementById("recordSelect"),
  product: document.getElementById("product"),
  customProductName: document.getElementById("customProductName"),
  quickProductAmount: document.getElementById("quickProductAmount"),
  quickProductName: document.getElementById("quickProductName"),
  quickAddProduct: document.getElementById("quickAddProduct"),
  quickAddProductInline: document.getElementById("quickAddProductInline"),
  quickUndoProductChange: document.getElementById("quickUndoProductChange"),
  quickDeleteProduct: document.getElementById("quickDeleteProduct"),
  productRuleList: document.getElementById("productRuleList"),
  productRuleAmount: document.getElementById("productRuleAmount"),
  productRuleName: document.getElementById("productRuleName"),
  addProductRule: document.getElementById("addProductRule"),
  undoProductRuleChange: document.getElementById("undoProductRuleChange"),
  productAliasList: document.getElementById("productAliasList"),
  productAliasKeywords: document.getElementById("productAliasKeywords"),
  productAliasName: document.getElementById("productAliasName"),
  addProductAlias: document.getElementById("addProductAlias"),
  applyRecurringAliasPreset: document.getElementById("applyRecurringAliasPreset"),
  rate: document.getElementById("rate"),
  rateSource: document.getElementById("rateSource"),
  invoiceNo: document.getElementById("invoiceNo"),
  invoiceDate: document.getElementById("invoiceDate"),
  sheetUrl: document.getElementById("sheetUrl"),
  targetGmailAccount: document.getElementById("targetGmailAccount"),
  sheetName: document.getElementById("sheetName"),
  sheetStartCell: document.getElementById("sheetStartCell"),
  sheetDirection: document.getElementById("sheetDirection"),
  sheetActionStatus: document.getElementById("sheetActionStatus"),
  sheetTargetSummary: document.getElementById("sheetTargetSummary"),
  createDefaultSheet: document.getElementById("createDefaultSheet"),
  sheetHealthCard: document.getElementById("sheetHealthCard"),
  sheetsApiSetupLink: document.getElementById("sheetsApiSetupLink"),
  googleStatus: document.getElementById("googleStatus"),
  enableEmailBridge: document.getElementById("enableEmailBridge"),
  bridgeUrl: document.getElementById("bridgeUrl"),
  bridgeStatus: document.getElementById("bridgeStatus"),
  bridgeServiceState: document.getElementById("bridgeServiceState"),
  bridgeLastSync: document.getElementById("bridgeLastSync"),
  bridgeNextSync: document.getElementById("bridgeNextSync"),
  bridgeScanned: document.getElementById("bridgeScanned"),
  bridgeMatched: document.getElementById("bridgeMatched"),
  bridgeNeedReview: document.getElementById("bridgeNeedReview"),
  bridgeDuplicates: document.getElementById("bridgeDuplicates"),
  checkBridge: document.getElementById("checkBridge"),
  syncBridge: document.getElementById("syncBridge"),
  importBridgePayment: document.getElementById("importBridgePayment"),
  viewBridgeRecords: document.getElementById("viewBridgeRecords"),
  openBridgeSetup: document.getElementById("openBridgeSetup"),
  bridgeRecordsPreview: document.getElementById("bridgeRecordsPreview"),
  vatPercent: document.getElementById("vatPercent"),
  paypalFeePercent: document.getElementById("paypalFeePercent"),
  autoCopy: document.getElementById("autoCopy"),
  strictValidation: document.getElementById("strictValidation"),
  appendAccounting: document.getElementById("appendAccounting"),
  autoIncrementInvoice: document.getElementById("autoIncrementInvoice"),
  autoWriteSheet: document.getElementById("autoWriteSheet"),
  fontFamily: document.getElementById("fontFamily"),
  fontSize: document.getElementById("fontSize"),
  primaryColor: document.getElementById("primaryColor"),
  panelColor: document.getElementById("panelColor"),
  sourceRulesText: document.getElementById("sourceRulesText"),
  ruleMode: document.getElementById("ruleMode"),
  gatewayRulesList: document.getElementById("gatewayRulesList"),
  gatewayRulesJson: document.getElementById("gatewayRulesJson"),
  saveGatewayRules: document.getElementById("saveGatewayRules"),
  applyRecommendedPresets: document.getElementById("applyRecommendedPresets"),
  resetPresetRules: document.getElementById("resetPresetRules"),
  resetGatewayRules: document.getElementById("resetGatewayRules"),
  exportGatewayRules: document.getElementById("exportGatewayRules"),
  importGatewayRules: document.getElementById("importGatewayRules"),
  gatewayRuleWarnings: document.getElementById("gatewayRuleWarnings"),
  addCustomRule: document.getElementById("addCustomRule"),
  testCustomRule: document.getElementById("testCustomRule"),
  customRuleTestContent: document.getElementById("customRuleTestContent"),
  customRuleTestResult: document.getElementById("customRuleTestResult"),
  rulesText: document.getElementById("rulesText"),
  sheetAccountHint: document.getElementById("sheetAccountHint"),
  sheetRow: document.getElementById("sheetRow"),
  historyList: document.getElementById("historyList"),
  exportSettings: document.getElementById("exportSettings"),
  importSettings: document.getElementById("importSettings"),
  importSettingsFile: document.getElementById("importSettingsFile"),
  fields: {
    date: document.getElementById("fieldDate"),
    type: document.getElementById("fieldType"),
    customerName: document.getElementById("fieldCustomerName"),
    customerEmail: document.getElementById("fieldCustomerEmail"),
    orderNo: document.getElementById("fieldOrderNo"),
    usd: document.getElementById("fieldUsd"),
    transactionId: document.getElementById("fieldTransactionId"),
    profileId: document.getElementById("fieldProfileId")
  }
};

function storageGet(keys) {
  return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
}

function storageSet(value) {
  return new Promise((resolve) => chrome.storage.local.set(value, resolve));
}

function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function fetchWithTimeout(url, options = {}, timeoutMs = GOOGLE_API_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && err.name === "AbortError") throw new Error(t("googleApiTimeout"));
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function todayVN() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function moneyNumber(v) {
  const n = Number(String(v || "").replace(/[$,]/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function vnd(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}

function find(text, patterns) {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return "";
}

function setStatus(message, type = "ready") {
  el.status.textContent = message;
  el.status.className = `status ${type}`;
}

function hasConnectedPaymentSource() {
  if (isLocalEmailSyncMode() || isCloudSyncMode()) return Boolean(workflowContext.emailBridge && workflowContext.emailBridge.ok);
  return Boolean(connectedGmail);
}

function renderSetupChecklist() {
  const hasGmail = hasConnectedPaymentSource();
  const hasSheet = Boolean(spreadsheetIdFromUrl(el.sheetUrl && el.sheetUrl.value));
  const hasPayments = Boolean(records.length || bridgeQueueRecords.length);
  [
    [el.setupGmailState, hasGmail],
    [el.setupSheetState, hasSheet],
    [el.setupScanState, hasPayments]
  ].forEach(([node, done]) => {
    if (!node) return;
    node.textContent = done ? t("setupDone") : t("setupMissing");
    node.dataset.state = done ? "done" : "missing";
    const item = node.closest(".setup-check-item");
    if (item) item.dataset.state = done ? "done" : "missing";
  });
  renderGuidedSetup({ hasGmail, hasSheet, hasPayments });
}

function renderGuidedSetup(state = {}) {
  if (!el.guidedSetupCard) return;
  const hasGmail = state.hasGmail ?? hasConnectedPaymentSource();
  const hasSheet = state.hasSheet ?? Boolean(spreadsheetIdFromUrl(el.sheetUrl && el.sheetUrl.value));
  const hasPayments = state.hasPayments ?? Boolean(records.length || bridgeQueueRecords.length);
  if (hasGmail && hasSheet && hasPayments && tipDismissed("guidedSetupReady")) {
    el.guidedSetupCard.hidden = true;
    return;
  }
  let model;
  if (!hasGmail) {
    model = { step: "1/3", title: t("guidedGmailTitle"), help: t("guidedGmailHelp"), action: t("quickFixConnectGmail"), kind: "connect-gmail", state: "missing" };
  } else if (!hasSheet) {
    model = { step: "2/3", title: t("guidedSheetTitle"), help: t("guidedSheetHelp"), action: t("quickFixCreateSheet"), kind: "create-sheet", state: "missing" };
  } else if (!hasPayments) {
    model = { step: "3/3", title: t("guidedScanTitle"), help: t("guidedScanHelp"), action: t("quickFixTryAgain"), kind: "scan", state: "ready" };
  } else {
    model = { step: "OK", title: t("guidedReadyTitle"), help: t("guidedReadyHelp"), action: t("guidedDismiss"), kind: "dismiss", state: "done" };
  }
  el.guidedSetupCard.hidden = false;
  el.guidedSetupCard.dataset.state = model.state;
  el.guidedSetupStep.textContent = model.step;
  el.guidedSetupTitle.textContent = model.title;
  el.guidedSetupHelp.textContent = model.help;
  el.guidedSetupAction.textContent = model.action;
  el.guidedSetupAction.dataset.setupAction = model.kind;
}

function showQuickFixActions(kind = "") {
  if (!el.quickFixActions) return;
  const actions = [];
  if (kind === "gmail") {
    actions.push(`<button type="button" data-fix-action="connect-gmail">${escapeHtml(t("quickFixConnectGmail"))}</button>`);
    actions.push(`<button type="button" data-fix-action="scan">${escapeHtml(t("quickFixTryAgain"))}</button>`);
  } else if (kind === "sheet") {
    actions.push(`<button type="button" data-fix-action="create-sheet">${escapeHtml(t("quickFixCreateSheet"))}</button>`);
    actions.push(`<button type="button" data-fix-action="sheet-settings">${escapeHtml(t("quickFixOpenSettings"))}</button>`);
  }
  el.quickFixActions.innerHTML = actions.join("");
  el.quickFixActions.hidden = !actions.length;
}

function hideQuickFixActions() {
  if (!el.quickFixActions) return;
  el.quickFixActions.hidden = true;
  el.quickFixActions.innerHTML = "";
}

async function runSetupAction(action) {
  if (action === "connect-gmail") {
    await connectGmailAccount();
  } else if (action === "create-sheet") {
    await setupDefaultSheet();
  } else if (action === "sheet-settings") {
    openSettingsTarget("sheet");
  } else if (action === "scan") {
    await startPaymentWorkflow();
  } else if (action === "dismiss" && el.guidedSetupCard) {
    setTipDismissed("guidedSetupReady", true);
    await saveConfig();
    el.guidedSetupCard.hidden = true;
  }
}

function setOAuthUserLog(message = "", state = "ready") {
  el.oauthUserLog.hidden = !message;
  el.oauthUserLog.textContent = message;
  el.oauthUserLog.dataset.state = state;
}

function userFriendlyOAuthError(error) {
  const original = String(error && error.oauthRaw ? error.oauthRaw : googleErrorText(error)).trim();
  const raw = original.toLowerCase();
  if (/bad client|invalid client|unauthorized_client|oauth.*setup/.test(raw)) return t("oauthLogConfig");
  if (/not signed in|signin|sign-in|no google account/.test(raw)) return t("oauthLogProfile");
  if (/denied|did not approve|permission|access_denied|403/.test(raw)) return t("oauthLogPermission");
  if (/timeout|network|failed to fetch|offline/.test(raw)) return t("oauthLogNetwork");
  if (original && original !== t("oauthLogGeneric")) return `${t("oauthLogGeneric")} (${original.slice(0, 180)})`;
  return t("oauthLogGeneric");
}

function renderThemeToggle() {
  el.themeToggle.innerHTML = `<span aria-hidden="true">${document.body.classList.contains("dark") ? "☀" : "◐"}</span>`;
}

function renderSettingsToggle() {
  const isOpen = !el.settingsPanel.hidden;
  el.settingsToggle.innerHTML = `<span aria-hidden="true">⚙</span>`;
  el.settingsToggle.classList.toggle("active", isOpen);
  el.settingsToggle.setAttribute("aria-expanded", String(isOpen));
}

function toggleSettingsPanel(forceOpen) {
  const shouldOpen = forceOpen === undefined ? el.settingsPanel.hidden : Boolean(forceOpen);
  el.settingsPanel.hidden = !shouldOpen;
  renderSettingsToggle();
}

function tipDismissed(key) {
  return Boolean(config.dismissedTips && config.dismissedTips[key]);
}

function setTipDismissed(key, value = true) {
  config.dismissedTips = { ...(config.dismissedTips || {}), [key]: Boolean(value) };
  saveConfig();
}

function setSmartTip(node, key, show) {
  if (!node) return;
  node.hidden = !(show && !tipDismissed(key));
}

function openSettingsTarget(target) {
  toggleSettingsPanel(true);
  const sheetGroup = document.getElementById("sheetSettingsGroup");
  const rulesGroup = document.getElementById("rulesSettingsGroup");
  const targetMap = {
    sheet: [sheetGroup, sheetGroup],
    productRules: [rulesGroup, document.getElementById("productRulesBlock")],
    providerRules: [rulesGroup, document.getElementById("providerRulesBlock")]
  };
  const [group, focusNode] = targetMap[target] || [];
  if (group) group.open = true;
  setTimeout(() => {
    const node = focusNode || group || el.settingsPanel;
    if (node && node.scrollIntoView) node.scrollIntoView({ behavior: "smooth", block: "start" });
    if (node && node.classList) {
      node.classList.add("smart-highlight");
      setTimeout(() => node.classList.remove("smart-highlight"), 1600);
    }
  }, 80);
}

function productNeedsRuleTip(d = formData()) {
  const product = String(d.product || el.product.value || "").trim();
  const hasAmount = moneyNumber(d.usd || el.fields.usd && el.fields.usd.value) > 0;
  return hasAmount && (!product || REVIEW_PRODUCT_PATTERN.test(product));
}

function renderSmartSuggestions(d) {
  const activeRecord = d || records[activeIndex] || formData();
  setSmartTip(el.productRuleSuggestion, "productRules", productNeedsRuleTip(activeRecord));
  const needsSheetHelp = !String(el.sheetName && el.sheetName.value || "").trim() || !String(el.sheetStartCell && el.sheetStartCell.value || "").trim();
  setSmartTip(el.sheetSettingsSuggestion, "sheetSettings", needsSheetHelp);
}

function maybeShowProductTip() {
  setSmartTip(el.productRuleSuggestion, "productRules", true);
}

function maybeShowSheetTip() {
  setSmartTip(el.sheetSettingsSuggestion, "sheetSettings", true);
}

function setGoogleConnectAvailable() {
  if (googleAuthInProgress) return;
  el.connectGoogle.disabled = false;
  el.connectGoogle.removeAttribute("aria-disabled");
}

function setBusy(isBusy) {
  [el.autoRun, el.buildOnly, el.forceCopy, el.getRate, el.quickRefreshRate, el.saveSettings, el.saveRules, el.copyRow, el.writeSheet, el.testSheet, el.copyAllRows, el.exportCsv, el.dashboardExportCsv, el.bulkCopyReady, el.bulkSaveReady, el.copyInvoiceDraft, el.copyAccountingRow, el.copyAccountingGuide, el.exportAccountingSample, el.exportMisaCsv, el.exportAccountingCsv].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
  });
  setGoogleConnectAvailable();
}

function setSheetActionBusy(isBusy) {
  [el.writeSheet, el.testSheet, el.createDefaultSheet, el.bulkSaveReady].forEach((button) => {
    if (!button) return;
    button.disabled = isBusy;
  });
  setGoogleConnectAvailable();
}

function parseRules(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (!line.includes("=")) {
        const nameOnly = line.trim();
        return nameOnly ? { amount: 0, name: nameOnly } : null;
      }
      const parts = line.split("=");
      const rawAmount = parts.shift();
      const amount = moneyNumber(rawAmount);
      const name = parts.join("=").trim();
      return name ? { amount, name } : null;
    })
    .filter(Boolean)
    .filter((rule) => rule.name && !REVIEW_PRODUCT_PATTERN.test(rule.name));
}

function rulesToText(rules) {
  return (rules || [])
    .filter((rule) => rule && rule.name && !REVIEW_PRODUCT_PATTERN.test(rule.name))
    .map((rule) => rule.amount ? `${rule.amount}=${rule.name}` : rule.name)
    .join("\n");
}

function isInternalProductRulesText(text) {
  return INTERNAL_PRODUCT_PATTERN.test(String(text || ""));
}

function isLegacySampleProductName(name) {
  const value = String(name || "").trim().toLowerCase();
  return legacySampleProductNames.some((sample) => sample.toLowerCase() === value);
}

function sanitizeProductRulesText(text) {
  if (!String(text || "").trim() || isInternalProductRulesText(text)) return "";
  const cleaned = parseRules(text).filter((rule) => !INTERNAL_PRODUCT_PATTERN.test(rule.name) && !isLegacySampleProductName(rule.name));
  return cleaned.length ? rulesToText(cleaned) : "";
}

function currentRules() {
  const parsed = parseRules(el.rulesText.value);
  return parsed.filter((rule) => !isLegacySampleProductName(rule.name));
}

function normalizeProductAliases(aliases = []) {
  return (Array.isArray(aliases) ? aliases : [])
    .map((alias) => ({
      keywords: Array.isArray(alias.keywords)
        ? alias.keywords.map((item) => String(item || "").trim()).filter(Boolean)
        : String(alias.keywords || "").split(",").map((item) => item.trim()).filter(Boolean),
      name: String(alias.name || "").trim()
    }))
    .filter((alias) => alias.name && alias.keywords.length);
}

function currentProductAliases() {
  return normalizeProductAliases(config.productAliases || []);
}

function productAliasFromText(text) {
  const haystack = normalizeText(text || "").toLowerCase();
  if (!haystack) return null;
  return currentProductAliases().find((alias) => alias.keywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) || null;
}

function resolveProductName({ manual = "", selected = "", emailProduct = "", amount = "", text = "" } = {}) {
  const typed = String(manual || "").trim();
  if (typed) return { value: typed, source: "manual" };
  const chosen = String(selected || "").trim();
  if (chosen && !REVIEW_PRODUCT_PATTERN.test(chosen)) return { value: chosen, source: "selected" };
  const alias = productAliasFromText(`${text}\n${emailProduct}`);
  if (alias) return { value: alias.name, source: "product alias" };
  const rawProduct = String(emailProduct || "").trim();
  if (rawProduct) return { value: rawProduct, source: "email product" };
  const byAmount = guessProduct(amount);
  return { value: byAmount, source: byAmount ? "amount rule" : "" };
}

function renderProductAliasManager() {
  if (!el.productAliasList) return;
  const aliases = currentProductAliases();
  el.productAliasList.innerHTML = aliases.map((alias, index) => `
    <div class="product-alias-chip">
      <div><span>${escapeHtml(alias.keywords.join(", "))}</span><strong>${escapeHtml(alias.name)}</strong></div>
      <button type="button" class="product-alias-delete" data-index="${index}">×</button>
    </div>
  `).join("");
}

function setProductAliases(aliases) {
  config.productAliases = normalizeProductAliases(aliases);
  renderProductAliasManager();
  updateRow();
  scheduleSaveConfig();
}

function addProductAlias(keywords, name) {
  const next = normalizeProductAliases([...currentProductAliases(), { keywords, name }]);
  const cleanName = String(name || "").trim();
  const cleanKeywords = String(keywords || "").split(",").map((item) => item.trim()).filter(Boolean);
  if (!cleanName || !cleanKeywords.length) {
    setStatus(t("productAliasMissing"), "warning");
    return false;
  }
  setProductAliases(next.filter((alias, index, list) => list.findIndex((item) => item.name.toLowerCase() === alias.name.toLowerCase() && item.keywords.join("|").toLowerCase() === alias.keywords.join("|").toLowerCase()) === index));
  setStatus(t("productAliasAdded"), "success");
  return true;
}

function deleteProductAlias(index) {
  const aliases = currentProductAliases().filter((_, itemIndex) => itemIndex !== index);
  setProductAliases(aliases);
  setStatus(t("productAliasDeleted"), "success");
}

function productRulesSnapshot() {
  return rulesToText(currentRules());
}

function pushProductRulesUndo(reason = "change") {
  productRuleUndoStack.push({ reason, rulesText: productRulesSnapshot(), selectedProduct: el.product ? el.product.value : "" });
  productRuleUndoStack = productRuleUndoStack.slice(-8);
}

function updateProductUndoButtons() {
  const disabled = !productRuleUndoStack.length;
  [el.quickUndoProductChange, el.undoProductRuleChange].forEach((button) => {
    if (!button) return;
    button.disabled = disabled;
    button.classList.toggle("is-disabled", disabled);
  });
}

function undoLastProductRuleChange() {
  const previous = productRuleUndoStack.pop();
  if (!previous) {
    setStatus(t("productUndoEmpty"), "warning");
    updateProductUndoButtons();
    return false;
  }
  el.rulesText.value = previous.rulesText || defaultConfig.rulesText;
  fillProductOptions();
  renderProductRuleManager();
  if (previous.selectedProduct && Array.from(el.product.options).some((option) => option.value === previous.selectedProduct)) {
    el.product.value = previous.selectedProduct;
  } else {
    el.product.value = "";
  }
  config.product = el.product.value;
  updateRow();
  scheduleSaveConfig();
  updateProductUndoButtons();
  setStatus(t("productUndoDone"), "success");
  return true;
}

function setProductRules(rules) {
  const cleaned = [];
  const seen = new Set();
  (rules || []).forEach((rule) => {
    const name = String(rule && rule.name || "").trim();
    if (!name || REVIEW_PRODUCT_PATTERN.test(name)) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    cleaned.push({ amount: moneyNumber(rule.amount), name });
  });
  el.rulesText.value = rulesToText(cleaned);
  fillProductOptions();
  renderProductRuleManager();
  renderProductAliasManager();
  updateProductUndoButtons();
  updateRow();
}

function addProductRuleItem(name, amount = 0, { select = true } = {}) {
  const cleanName = String(name || "").trim();
  if (!cleanName) {
    setStatus(t("productNameMissing"), "warning");
    return false;
  }
  const rules = currentRules().filter((rule) => rule.name.toLowerCase() !== cleanName.toLowerCase());
  pushProductRulesUndo("add");
  rules.push({ amount: moneyNumber(amount), name: cleanName });
  setProductRules(rules);
  if (select) {
    el.product.value = cleanName;
    config.product = cleanName;
    updateRow();
  }
  scheduleSaveConfig();
  setStatus(t("productAdded"), "success");
  return true;
}

function deleteProductRuleItem(name) {
  const selectedName = String(name || el.product.value || "").trim();
  if (!selectedName || REVIEW_PRODUCT_PATTERN.test(selectedName)) {
    setStatus(t("productDeleteEmpty"), "warning");
    return false;
  }
  const current = currentRules();
  const nextRules = current.filter((rule) => rule.name.toLowerCase() !== selectedName.toLowerCase());
  if (nextRules.length === current.length) {
    setStatus(t("productDeleteEmpty"), "warning");
    return false;
  }
  pushProductRulesUndo("delete");
  setProductRules(nextRules);
  if (el.product.value === selectedName) el.product.value = "";
  config.product = el.product.value;
  updateRow();
  scheduleSaveConfig();
  setStatus(t("productDeleted"), "success");
  return true;
}

function renderProductRuleManager() {
  if (!el.productRuleList) return;
  const rules = currentRules();
  el.productRuleList.innerHTML = rules.map((rule) => {
    const amount = rule.amount ? `$${escapeHtml(rule.amount)}` : t("manualLabel");
    return `<div class="product-rule-chip" data-product="${escapeHtml(rule.name)}"><span>${escapeHtml(amount)}</span><strong>${escapeHtml(rule.name)}</strong><button type="button" class="product-rule-delete" data-product="${escapeHtml(rule.name)}">×</button></div>`;
  }).join("");
}

function parsePaymentSourceRules(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [provider = "", domains = "", keywords = ""] = line.split("|");
      const cleanProvider = provider.trim();
      if (!cleanProvider) return null;
      return {
        provider: cleanProvider,
        domains: domains.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean),
        keywords: keywords.split(",").map((item) => item.trim().toLowerCase()).filter(Boolean)
      };
    })
    .filter(Boolean);
}

function currentPaymentSourceRules() {
  const parsed = parsePaymentSourceRules(el.sourceRulesText.value);
  return parsed.length ? parsed : defaultPaymentSourceRules;
}

function detectPaymentProvider(text, from = "", subject = "") {
  const haystack = `${from}\n${subject}\n${text}`.toLowerCase();
  let fallback = "";
  for (const rule of currentPaymentSourceRules()) {
    const domainMatch = rule.domains.some((domain) => haystack.includes(domain));
    const keywordMatch = rule.keywords.some((keyword) => haystack.includes(keyword));
    if (domainMatch || keywordMatch) {
      if (rule.provider.toLowerCase() !== "generic") return rule.provider;
      fallback = rule.provider;
    }
  }
  return fallback;
}

function fillProductOptions() {
  const rules = currentRules();
  const selected = REVIEW_PRODUCT_PATTERN.test(el.product.value || config.product || "") ? "" : (el.product.value || config.product || "");
  const unique = [...new Set(rules.map((r) => r.name).filter((name) => name && !REVIEW_PRODUCT_PATTERN.test(name)))];
  el.product.innerHTML = `<option value="">${escapeHtml(t("productAuto"))}</option>` + unique.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  el.product.value = unique.includes(selected) ? selected : "";
  renderProductRuleManager();
}

function fillFontOptions() {
  const selected = el.fontFamily.value || config.fontFamily || defaultConfig.fontFamily;
  el.fontFamily.innerHTML = fontOptions.map((font) => `<option value="${escapeHtml(font.value)}">${escapeHtml(font.value)}</option>`).join("");
  el.fontFamily.value = fontOptions.some((font) => font.value === selected) ? selected : defaultConfig.fontFamily;
}

function fillDirectionOptions() {
  const selected = el.sheetDirection.value || config.sheetDirection || defaultConfig.sheetDirection;
  el.sheetDirection.innerHTML = [
    `<option value="down">${escapeHtml(t("directionDown"))}</option>`,
    `<option value="up">${escapeHtml(t("directionUp"))}</option>`
  ].join("");
  el.sheetDirection.value = selected === "up" ? "up" : "down";
}

function shadeColor(hex, percent) {
  const value = String(hex || "#1267b1").replace("#", "");
  const num = parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  const amount = Math.round(2.55 * percent);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (num & 255) + amount));
  return `#${(0x1000000 + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function applyAppearance() {
  const font = fontOptions.find((item) => item.value === el.fontFamily.value) || fontOptions[0];
  const fontSize = Math.max(12, Math.min(18, Number(el.fontSize.value || defaultConfig.fontSize)));
  const primary = el.primaryColor.value || defaultConfig.primaryColor;
  const dark = document.body.classList.contains("dark");
  document.documentElement.style.setProperty("--app-font", font.css);
  document.documentElement.style.setProperty("--app-font-size", `${fontSize}px`);
  document.documentElement.style.setProperty("--primary", primary);
  document.documentElement.style.setProperty("--primary-dark", shadeColor(primary, -18));
  document.documentElement.style.setProperty("--bg", dark ? "#090909" : "#f3f4f6");
  document.documentElement.style.setProperty("--panel", dark ? "#151515" : "#ffffff");
  document.documentElement.style.setProperty("--panel-2", dark ? "#1d1d1d" : "#f7f7f8");
  document.documentElement.style.setProperty("--text", dark ? "#f5f5f5" : "#111827");
  document.documentElement.style.setProperty("--muted", dark ? "#a3a3a3" : "#667085");
  document.documentElement.style.setProperty("--soft", dark ? "#202020" : shadeColor(primary, 88));
}

function guessProduct(amount) {
  const usd = moneyNumber(amount);
  const found = currentRules().find((x) => x.amount > 0 && Math.abs(x.amount - usd) < 0.01);
  return found ? found.name : "";
}

function productFromEmailText(text) {
  const value = normalizeText(text || "");
  const match = value.match(/(?:^|\n)\s*For\s*[:\n]?\s*(?!Order number\b)([^\n]+)/im)
    || value.match(/(?:Item|Product|Description|Service)\s*[:\n]?\s*([^\n]+)/i);
  return match && match[1] ? match[1].trim() : "";
}

function parseDateVN(text) {
  const value = String(text || "");
  const direct = value.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})/);
  if (direct) return `${String(direct[1]).padStart(2, "0")}/${String(direct[2]).padStart(2, "0")}/${direct[3]}`;
  const m = value.match(/([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})/i);
  if (!m) return todayVN();
  const months = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
  return `${String(m[2]).padStart(2, "0")}/${months[m[1].slice(0, 3).toLowerCase()] || "01"}/${m[3]}`;
}

function normalizeText(text) {
  return String(text || "").replace(/\u00a0/g, " ").replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
}

function detectType(text) {
  if (/refund|refunded/i.test(text)) return "Refund";
  if (/dispute|chargeback|case ID/i.test(text)) return "Dispute / chargeback";
  if (/subscription|profile id|billing agreement|automatic payment|recurring|amount paid each time/i.test(text)) return "Recurring / subscription";
  if (/invoice paid|paid your invoice/i.test(text)) return "Invoice paid";
  if (/you received a payment|amount received|payment received/i.test(text)) return "Payment received";
  return /paypal/i.test(text) ? "PayPal email" : "";
}

function isRecurringRecord(d) {
  return /recurring|subscription|automatic payment/i.test(d.type || "") || Boolean(d.profileId || d.billingAgreementId || d.subscriptionId);
}

function referenceFromRecurring(d) {
  if (d.orderNo) return { value: d.orderNo, source: "order" };
  if (d.profileId) return { value: `PROFILE: ${d.profileId}`, source: "profile id" };
  if (d.billingAgreementId) return { value: `BILLING: ${d.billingAgreementId}`, source: "billing agreement id" };
  if (d.subscriptionId) return { value: `SUBSCRIPTION: ${d.subscriptionId}`, source: "subscription id" };
  if (d.transactionId) return { value: `TXN: ${d.transactionId}`, source: "transaction id" };
  return { value: "", source: "" };
}

function confidence(value, source) {
  return { ok: Boolean(value), source };
}

function parsePayPal(text) {
  const t = normalizeText(text);
  const dateRaw = find(t, [
    /([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\s+\d{1,2}:\d{2}/i,
    /Sent:\s*(?:\w+,\s*)?([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i,
    /Date:\s*([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i,
    /(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4})/
  ]);
  const customerName = find(t, [
    /Customer name\s*\n?\s*([^\n]+)/i,
    /You received a payment from\s+(.+?)\s+for Order/i,
    /payment from\s+(.+?)\s+for Order/i,
    /(.+?)\s+sent you\s+\$?[0-9,.]+\s*USD/i,
    /From:\s*([^\n<]+)</i
  ]);
  const customerEmail = find(t, [
    /Customer email\s*\n?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /Payer email\s*\n?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /Buyer email\s*\n?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i
  ]);
  const orderNo = find(t, [
    /Order number:\s*([A-Za-z0-9_-]+)/i,
    /Order ID:\s*([A-Za-z0-9_-]+)/i,
    /Invoice ID:\s*([A-Za-z0-9_-]+)/i,
    /Receipt ID:\s*([A-Za-z0-9_-]+)/i,
    /for Order number:\s*([A-Za-z0-9_-]+)/i,
    /For\s*\n?\s*Order number:\s*([A-Za-z0-9_-]+)/i
  ]);
  const amountReceived = find(t, [
    /Amount received\s*\n?\s*\$?([0-9,.]+)\s*USD/i,
    /Total\s*\n?\s*\$?([0-9,.]+)\s*USD/i,
    /Payment amount\s*\n?\s*\$?([0-9,.]+)\s*USD/i,
    /You received a payment[\s\S]{0,500}?\$?([0-9,.]+)\s*USD/i,
    /sent you\s+\$?([0-9,.]+)\s*USD/i
  ]);
  const trialAmount = find(t, [
    /Trial period amount\s*\n?\s*\$?([0-9,.]+)\s*USD/i,
    /First trial period amount\s*\n?\s*\$?([0-9,.]+)\s*USD/i
  ]);
  const amountEachTime = find(t, [/Amount paid each time\s*\n?\s*\$?([0-9,.]+)\s*USD/i]);
  const transactionId = find(t, [/Transaction ID:\s*([A-Z0-9]+)/i, /Transaction ID\s*\n?\s*([A-Z0-9]+)/i]);
  const profileId = find(t, [/Profile ID\s*\n?\s*([A-Z0-9-]+)/i, /Recurring Payment ID\s*\n?\s*([A-Z0-9-]+)/i]);
  const billingAgreementId = find(t, [/Billing Agreement ID\s*\n?\s*([A-Z0-9-]+)/i, /Billing ID\s*\n?\s*([A-Z0-9-]+)/i]);
  const subscriptionId = find(t, [/Subscription ID\s*\n?\s*([A-Z0-9-]+)/i, /Plan ID\s*\n?\s*([A-Z0-9-]+)/i]);
  const usd = amountReceived || trialAmount || amountEachTime;
  const productFromEmail = productFromEmailText(t);
  const resolvedProduct = resolveProductName({
    manual: el.customProductName && el.customProductName.value,
    selected: el.product.value,
    emailProduct: productFromEmail,
    amount: usd,
    text: t
  });
  const product = resolvedProduct.value;
  const type = detectType(t);
  const parsed = { date: parseDateVN(dateRaw), type, customerName, customerEmail, orderNo, usd, product, note: "Paypal", transactionId, profileId, billingAgreementId, subscriptionId, customFields: autoCustomFieldsFromText(t) };
  const recurringRef = referenceFromRecurring(parsed);
  if (!parsed.orderNo && isRecurringRecord(parsed)) parsed.orderNo = recurringRef.value;
  parsed.confidence = {
    type: confidence(type, type ? "keyword" : ""),
    customerName: confidence(customerName, "PayPal customer pattern"),
    customerEmail: confidence(customerEmail, "email pattern"),
    orderNo: confidence(parsed.orderNo, orderNo ? "order/invoice pattern" : recurringRef.source),
    usd: confidence(usd, "USD amount pattern"),
    product: confidence(product, resolvedProduct.source)
  };
  return parsed;
}

function parseBlocks(text) {
  const t = normalizeText(text);
  const markers = [...t.matchAll(/Transaction ID:\s*[A-Z0-9]+/gi)];
  if (markers.length <= 1) return [t];
  return markers.map((match, idx) => {
    const start = Math.max(0, match.index - 1200);
    const end = idx + 1 < markers.length ? Math.max(markers[idx + 1].index - 100, match.index + 200) : Math.min(t.length, match.index + 1800);
    return t.slice(start, end);
  });
}

function missingFields(d) {
  const missing = [];
  const en = config.language === "en";
  if (!d.type) missing.push(en ? "PayPal email type" : "loại email PayPal");
  if (!d.customerName) missing.push(en ? "customer name" : "tên khách hàng");
  if (!d.customerEmail) missing.push("email");
  if (!d.usd) missing.push(en ? "USD amount" : "số tiền USD");
  if (!d.product) missing.push(en ? "product" : "sản phẩm");
  if (!moneyNumber(el.rate.value)) missing.push(en ? "rate" : "tỷ giá");
  if (d.isDuplicate && !d.duplicateApproved) missing.push(en ? "duplicate confirmation" : "xác nhận giao dịch trùng");
  return missing;
}

function accounting(d) {
  const rate = moneyNumber(el.rate.value);
  const usd = moneyNumber(d.usd);
  const grossVnd = usd * rate;
  const fee = grossVnd * moneyNumber(el.paypalFeePercent.value) / 100;
  const net = grossVnd - fee;
  const vat = net * moneyNumber(el.vatPercent.value) / 100;
  const revenueBeforeTax = net - vat;
  return { grossVnd, fee, net, vat, revenueBeforeTax };
}

function cleanCustomFields(fields = []) {
  return (Array.isArray(fields) ? fields : [])
    .map((field) => ({
      name: String(field && field.name || "").trim(),
      value: String(field && field.value || "").trim(),
      writeToSheet: field && field.writeToSheet === true
    }))
    .filter((field) => field.name || field.value);
}

function customFieldDisplayName(name) {
  const raw = String(name || "").trim();
  if (config.language !== "vi") return raw || "Detail";
  const key = raw.toLowerCase().replace(/\s+/g, " ");
  const viMap = {
    "outstanding balance": "Số dư còn lại",
    "amount paid each time": "Số tiền mỗi lần thanh toán",
    "maximum amount you can bill": "Số tiền tối đa có thể thu",
    "next payment due": "Ngày thanh toán tiếp theo",
    "trial period amount": "Số tiền giai đoạn dùng thử",
    "start date": "Ngày bắt đầu",
    "end date": "Ngày kết thúc",
    "receipt number": "Mã biên nhận",
    "invoice number": "Số hóa đơn",
    "payment method": "Phương thức thanh toán",
    "billing period": "Kỳ thanh toán",
    "plan": "Gói dịch vụ",
    "item": "Sản phẩm",
    "quantity": "Số lượng",
    "sku": "SKU",
    "subtotal": "Tạm tính",
    "tax": "Thuế",
    "discount": "Giảm giá",
    "shipping": "Phí vận chuyển",
    "fee": "Phí",
    "net amount": "Số tiền thực nhận",
    "card": "Thẻ",
    "source": "Nguồn",
    "detail": "Chi tiết"
  };
  return viMap[key] || raw || "Chi tiết";
}

function customFieldsText(fields = [], options = {}) {
  const onlyWritable = options.onlyWritable === true;
  return cleanCustomFields(fields)
    .filter((field) => !onlyWritable || field.writeToSheet === true)
    .map((field) => `${customFieldDisplayName(field.name)}: ${field.value}`)
    .join("; ");
}

function sanitizeSheetColumn(value, fallback = "L") {
  const match = String(value || "").trim().toUpperCase().match(/[A-Z]+/);
  return match ? match[0].slice(0, 3) : fallback;
}

function normalizeSheetFieldColumns(columns = {}) {
  return SHEET_FIELD_KEYS.reduce((next, key) => {
    next[key] = sanitizeSheetColumn(columns[key], DEFAULT_SHEET_FIELD_COLUMNS[key]);
    return next;
  }, {});
}

function collectSheetFieldColumns() {
  const saved = normalizeSheetFieldColumns(config.sheetFieldColumns || defaultConfig.sheetFieldColumns);
  if (!el.sheetColumnInputs) return saved;
  return SHEET_FIELD_KEYS.reduce((next, key) => {
    const input = el.sheetColumnInputs[key];
    next[key] = sanitizeSheetColumn(input && input.value, saved[key]);
    return next;
  }, {});
}

function applySheetFieldColumnsToInputs(columns = {}) {
  if (!el.sheetColumnInputs) return;
  const normalized = normalizeSheetFieldColumns(columns);
  SHEET_FIELD_KEYS.forEach((key) => {
    const input = el.sheetColumnInputs[key];
    if (input) input.value = normalized[key];
  });
}

function sheetFieldLabelKey(key) {
  return {
    date: "sheetColumnDate",
    customerName: "sheetColumnCustomer",
    orderNo: "sheetColumnReference",
    product: "sheetColumnProduct",
    usd: "sheetColumnUsd",
    provider: "sheetColumnProvider",
    grossVnd: "sheetColumnVnd",
    rate: "sheetColumnRate",
    invoiceNo: "sheetColumnInvoiceNo",
    invoiceDate: "sheetColumnInvoiceDate"
  }[key] || key;
}

function sheetFieldWritesFor(record = {}) {
  return { ...(record.sheetFieldWrites || {}) };
}

function sheetFieldWriteEnabled(record, key) {
  const writes = sheetFieldWritesFor(record);
  return writes[key] !== false;
}

function sheetFieldValue(record, key, value) {
  return sheetFieldWriteEnabled(record, key) ? value : "";
}

function sheetFieldDefinitions(d, invoiceNoOverride, invoiceDateOverride) {
  const rate = moneyNumber(el.rate.value);
  const a = accounting(d);
  const invoiceNo = invoiceNoOverride ?? el.invoiceNo.value.trim();
  const invoiceDate = invoiceDateOverride ?? el.invoiceDate.value.trim();
  return [
    { key: "date", value: sheetFieldValue(d, "date", d.date || "") },
    { key: "customerName", value: sheetFieldValue(d, "customerName", d.customerName || "") },
    { key: "orderNo", value: sheetFieldValue(d, "orderNo", d.orderNo || "") },
    { key: "product", value: sheetFieldValue(d, "product", d.product || "") },
    { key: "usd", value: sheetFieldValue(d, "usd", d.usd || "") },
    { key: "provider", value: d.note || d.provider || "Payment" },
    { key: "grossVnd", value: sheetFieldValue(d, "usd", vnd(a.grossVnd)) },
    { key: "rate", value: rate || "" },
    { key: "invoiceNo", value: invoiceNo },
    { key: "invoiceDate", value: invoiceDate }
  ].map((item) => ({ ...item, labelKey: sheetFieldLabelKey(item.key) }));
}

function placeSheetField(row, preview, start, desiredColumn, fallbackOrder, label, value, warnings, key = "") {
  const desiredNumber = columnNameToNumber(sanitizeSheetColumn(desiredColumn, columnNumberToName(start.colNumber + fallbackOrder)));
  const fallbackNumber = start.colNumber + fallbackOrder;
  const actualNumber = desiredNumber >= start.colNumber ? desiredNumber : fallbackNumber;
  const index = actualNumber - start.colNumber;
  if (desiredNumber < start.colNumber) warnings.beforeStart = true;
  while (row.length <= index) row.push("");
  const nextValue = String(value ?? "");
  if (row[index] && nextValue) row[index] = `${row[index]} | ${nextValue}`;
  else if (!row[index]) row[index] = nextValue;
  preview.push({
    key,
    column: columnNumberToName(actualNumber),
    label,
    value: row[index] || ""
  });
}

function buildSheetRowParts(d, invoiceNoOverride, invoiceDateOverride) {
  let start = null;
  const warnings = { beforeStart: false, invalidStart: false };
  try {
    start = parseA1Cell(el.sheetStartCell && el.sheetStartCell.value || defaultConfig.sheetStartCell);
  } catch (error) {
    start = parseA1Cell(defaultConfig.sheetStartCell);
    warnings.invalidStart = true;
  }
  const columns = collectSheetFieldColumns();
  const row = [];
  const preview = [];
  sheetFieldDefinitions(d, invoiceNoOverride, invoiceDateOverride).forEach((field, index) => {
    placeSheetField(row, preview, start, columns[field.key], index, t(field.labelKey), field.value, warnings, field.key);
  });

  const detailText = customFieldsText(d.customFields, { onlyWritable: true });
  if (detailText && el.writeCustomFields && el.writeCustomFields.checked) {
    const fallbackOrder = Math.max(row.length, SHEET_FIELD_KEYS.length);
    placeSheetField(row, preview, start, el.customFieldsSheetColumn && el.customFieldsSheetColumn.value, fallbackOrder, t("customFieldsTitle"), detailText, warnings, "customFields");
  }

  if (el.appendAccounting.checked) {
    [
      d.provider || d.note || "Payment",
      d.emailType || d.type,
      d.status || "",
      d.customerEmail,
      d.transactionId,
      d.profileId,
      d.subscriptionId || "",
      d.revenueImpact || "",
      vnd(accounting(d).fee),
      vnd(accounting(d).net),
      vnd(accounting(d).vat),
      vnd(accounting(d).revenueBeforeTax)
    ].forEach((value) => row.push(value || ""));
  }
  return { row, preview, warnings, start };
}

function applyCustomFieldsToSheetRow(base, detailText) {
  const row = [...base];
  if (!detailText || !el.writeCustomFields || !el.writeCustomFields.checked) return row;
  const start = parseA1Cell(el.sheetStartCell && el.sheetStartCell.value || defaultConfig.sheetStartCell) || parseA1Cell(defaultConfig.sheetStartCell);
  const targetColumn = sanitizeSheetColumn(el.customFieldsSheetColumn && el.customFieldsSheetColumn.value, defaultConfig.customFieldsSheetColumn);
  const targetNumber = columnNameToNumber(targetColumn);
  const fallbackIndex = Math.max(base.length, columnNameToNumber(defaultConfig.customFieldsSheetColumn) - start.colNumber);
  const targetIndex = targetNumber >= start.colNumber ? targetNumber - start.colNumber : fallbackIndex;
  while (row.length <= targetIndex) row.push("");
  row[targetIndex] = row[targetIndex] ? `${row[targetIndex]} | ${detailText}` : detailText;
  return row;
}

function autoCustomFieldsFromText(text) {
  const value = normalizeText(text || "");
  const fields = [];
  const seen = new Set();
  function add(name, rawValue, options = {}) {
    const cleanName = String(name || "").trim();
    const cleanValue = String(rawValue || "").replace(/\s+/g, " ").trim();
    if (!cleanName || !cleanValue) return;
    if (cleanValue.length > 160) return;
    const key = `${plainKey(cleanName)}=${plainKey(cleanValue)}`;
    if (seen.has(key)) return;
    seen.add(key);
    fields.push({ name: cleanName, value: cleanValue, writeToSheet: options.writeToSheet === true });
  }
  const specs = [
    ["Outstanding balance", /Outstanding balance\s*\n?\s*([^\n]+)/i],
    ["Amount paid each time", /Amount paid each time\s*\n?\s*([^\n]+)/i],
    ["Maximum amount you can bill", /Maximum amount you can bill\s*\n?\s*([^\n]+)/i],
    ["Next payment due", /Next payment due\s*\n?\s*([^\n]+)/i],
    ["Trial period amount", /Trial period amount\s*\n?\s*([^\n]+)/i],
    ["Start date", /Start date\s*\n?\s*([^\n]+)/i],
    ["End date", /End date\s*\n?\s*([^\n]+)/i],
    ["Receipt number", /Receipt (?:number|#)\s*:?\s*([^\n]+)/i],
    ["Invoice number", /Invoice (?:number|#|ID)?\s*:?\s*([^\n]+)/i],
    ["Payment method", /Payment method\s*:?\s*([^\n]+)/i],
    ["Billing period", /Billing period\s*:?\s*([^\n]+)/i],
    ["Plan", /(?:Plan|Package)\s*:?\s*([^\n]+)/i],
    ["Item", /(?:Item|Product|Description|Service)\s*:?\s*([^\n]+)/i],
    ["Quantity", /(?:Quantity|Qty)\s*:?\s*([^\n]+)/i],
    ["SKU", /SKU\s*:?\s*([^\n]+)/i],
    ["Subtotal", /Subtotal\s*:?\s*([$€£]?\s*[0-9][0-9,.]*\s*[A-Z]{0,3})/i],
    ["Tax", /(?:Tax|VAT)\s*:?\s*([$€£]?\s*[0-9][0-9,.]*\s*[A-Z]{0,3})/i],
    ["Discount", /Discount\s*:?\s*([^\n]+)/i],
    ["Shipping", /Shipping\s*:?\s*([$€£]?\s*[0-9][0-9,.]*\s*[A-Z]{0,3})/i],
    ["Fee", /(?:Fee|Processing fee|PayPal fee)\s*:?\s*([$€£]?\s*-?[0-9][0-9,.]*\s*[A-Z]{0,3})/i],
    ["Net amount", /(?:Net amount|Net)\s*:?\s*([$€£]?\s*-?[0-9][0-9,.]*\s*[A-Z]{0,3})/i],
    ["Card", /(?:Card|Payment card)\s*:?\s*([^\n]+)/i]
  ];
  specs.forEach(([name, regex]) => {
    const match = value.match(regex);
    if (match && match[1]) add(name, match[1]);
  });
  const genericLabels = [
    "Receipt number", "Invoice number", "Payment method", "Billing period", "Plan", "Package",
    "Item", "Product", "Description", "Service", "Quantity", "Qty", "SKU", "Subtotal",
    "Tax", "VAT", "Discount", "Shipping", "Fee", "Processing fee", "Net amount",
    "Card", "Payment card", "Payer ID", "Customer ID", "Order status", "Payment status"
  ];
  const genericPattern = new RegExp(`(?:^|\\n)\\s*(${genericLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:?\\s*\\n?\\s*([^\\n]+)`, "gi");
  for (const match of value.matchAll(genericPattern)) {
    add(match[1], match[2]);
  }
  return fields.slice(0, 16);
}

function makeRow(d, invoiceNoOverride, invoiceDateOverride) {
  return buildSheetRowParts(d, invoiceNoOverride, invoiceDateOverride).row.join("\t");
}

function activeAccountingPreset() {
  return el.accountingPreset && el.accountingPreset.value ? el.accountingPreset.value : (config.accountingPreset || "invoice_standard");
}

function activeAccountingConnector() {
  const value = el.accountingConnector && el.accountingConnector.value ? el.accountingConnector.value : (config.accountingConnector || "csv");
  return ["csv", "misa", "quickbooks", "xero", "generic"].includes(value) ? value : "csv";
}

function accountingConnectorDefaultPreset(connector = activeAccountingConnector()) {
  if (connector === "misa") return "misa_basic";
  if (connector === "csv" || connector === "generic") return "universal";
  return "invoice_standard";
}

function renderAccountingConnectorStatus() {
  if (!el.accountingConnectorStatus) return;
  const url = el.accountingConnectorUrl ? String(el.accountingConnectorUrl.value || "").trim() : "";
  el.accountingConnectorStatus.textContent = url ? t("accountingConnectorReady") : t("accountingConnectorMissingUrl");
  el.accountingConnectorStatus.dataset.state = url ? "ready" : "empty";
}

function plainKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function templateColumnsFromText(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const separated = lines.find((line) => /[\t,;|]/.test(line) && line.split(/[\t,;|]/).filter(Boolean).length >= 3);
  if (separated) return separated.split(/[\t,;|]/).map((part) => part.trim()).filter(Boolean).slice(0, 40);
  const specs = [
    [/ngay|date/i, "Invoice date"],
    [/so\s*(hoa don|hd|no)|invoice\s*(no|number)/i, "Invoice no"],
    [/ho ten nguoi mua|ten nguoi mua|buyer|customer name/i, "Customer name"],
    [/email/i, "Customer email"],
    [/ma so thue|tax code|tax id/i, "Tax code"],
    [/dia chi|address/i, "Address"],
    [/ten hang hoa|hang hoa|dich vu|name of goods|product|item/i, "Item name"],
    [/don vi tinh|unit/i, "Unit"],
    [/so luong|quantity|qty/i, "Quantity"],
    [/don gia|unit price|price/i, "Unit price"],
    [/thanh tien|amount|total/i, "Total"],
    [/thue suat|vat|tax rate/i, "Tax rate"],
    [/hinh thuc thanh toan|payment method|provider/i, "Payment provider"],
    [/don vi tien te|currency/i, "Currency"],
    [/transaction|payment reference|ma giao dich/i, "Payment reference"],
    [/order|recurring|subscription|profile|ma tham chieu/i, "Order reference"],
    [/ghi chu|note|description/i, "Notes"]
  ];
  const normalized = plainKey(raw);
  const columns = [];
  specs.forEach(([regex, label]) => {
    if (regex.test(normalized) && !columns.includes(label)) columns.push(label);
  });
  return columns.length ? columns : ["Invoice date", "Customer name", "Customer email", "Item name", "Total", "Payment reference", "Notes"];
}

function customTemplateColumns() {
  return templateColumnsFromText(el.accountingTemplateText && el.accountingTemplateText.value || config.accountingTemplateText);
}

function accountingReference(record = {}) {
  return record.orderNo || record.profileId || record.subscriptionId || record.billingAgreementId || record.transactionId || "";
}

function accountingNotes(record = {}) {
  return [record.provider || record.note || "Payment", record.customerEmail || "", customFieldsText(record.customFields)]
    .filter(Boolean)
    .join(" | ");
}

function invoiceStatus(record = {}) {
  if (record.writtenToSheet) return "reviewed";
  if (record.isDuplicate && !record.duplicateApproved) return "needs_review";
  return record.status || "draft";
}

function accountingExportHeaders(preset = activeAccountingPreset()) {
  if (preset === "custom_template") {
    const columns = customTemplateColumns();
    return columns.length ? columns : accountingExportHeaders("invoice_standard");
  }
  if (preset === "invoice_standard") {
    return ["invoice_date", "invoice_no", "customer_name", "customer_email", "item_name", "description", "quantity", "unit_price", "currency", "subtotal", "tax_rate", "total", "payment_provider", "payment_reference", "order_reference", "status", "notes"];
  }
  if (preset === "misa_basic") {
    return ["Ngay thang", "Ten KH", "So Order", "Ten hang hoa dich vu", "Tong DT theo Order", "Ghi chu", "Thanh tien VND", "Ty gia", "So HD", "Ngay xuat hoa don"];
  }
  return ["date", "customer", "email", "product_service", "amount_usd", "amount_vnd", "currency", "payment_provider", "transaction_id", "order_reference", "subscription_id", "invoice_no", "invoice_date", "notes"];
}

function customTemplateValue(header, record = {}, a = accounting(record), rate = moneyNumber(el.rate.value), invoiceNo = "", invoiceDate = "") {
  const key = plainKey(header);
  const provider = record.provider || record.note || "Payment";
  const ref = accountingReference(record);
  if (/invoice.*date|ngay.*hd|ngay.*hoa don|^ngay$|date/.test(key)) return invoiceDate || record.date || "";
  if (/invoice.*no|invoice.*number|so.*hoa don|so.*hd|^so$/.test(key)) return invoiceNo;
  if (/customer.*email|buyer.*email|email/.test(key)) return record.customerEmail || "";
  if (/customer|buyer|ho ten nguoi mua|ten nguoi mua|khach hang|ten kh/.test(key)) return record.customerName || "";
  if (/tax code|tax id|ma so thue|mst/.test(key)) return "";
  if (/address|dia chi/.test(key)) return "";
  if (/item|product|service|goods|ten hang hoa|hang hoa|dich vu/.test(key)) return record.product || "";
  if (/unit price|don gia/.test(key)) return /vnd|thanh tien|tong/.test(key) ? vnd(a.grossVnd) : (record.usd || "");
  if (/quantity|qty|so luong/.test(key)) return "1";
  if (/unit|don vi tinh/.test(key)) return config.language === "en" ? "Package" : "Gói";
  if (/currency|don vi tien te/.test(key)) return record.currency || "USD";
  if (/tax rate|vat|thue suat/.test(key)) return moneyNumber(el.vatPercent.value) || 0;
  if (/amount|total|thanh tien|tong tien|subtotal/.test(key)) return /vnd|thanh tien vnd/.test(key) ? vnd(a.grossVnd) : (record.usd || "");
  if (/rate|ty gia/.test(key)) return rate || "";
  if (/payment reference|transaction|ma giao dich/.test(key)) return record.transactionId || "";
  if (/order|recurring|subscription|profile|reference|ma tham chieu|so order/.test(key)) return ref;
  if (/payment method|provider|hinh thuc thanh toan|cong thanh toan/.test(key)) return provider;
  if (/status|trang thai/.test(key)) return invoiceStatus(record);
  if (/note|description|ghi chu/.test(key)) return accountingNotes(record);
  return "";
}

function accountingExportValues(record = formData(), preset = activeAccountingPreset(), options = {}) {
  const a = accounting(record);
  const rate = moneyNumber(el.rate.value);
  const invoiceDate = options.ignoreForm ? (record.invoiceDate || record.date || "") : (el.invoiceDate.value.trim() || record.invoiceDate || record.date || "");
  const invoiceNo = options.ignoreForm ? (record.invoiceNo || "") : (el.invoiceNo.value.trim() || record.invoiceNo || "");
  if (preset === "custom_template") {
    return accountingExportHeaders("custom_template").map((header) => customTemplateValue(header, record, a, rate, invoiceNo, invoiceDate));
  }
  if (preset === "invoice_standard") {
    return [
      invoiceDate,
      invoiceNo,
      record.customerName || "",
      record.customerEmail || "",
      record.product || "",
      accountingNotes(record),
      "1",
      record.usd || "",
      record.currency || "USD",
      record.usd || "",
      moneyNumber(el.vatPercent.value) || 0,
      record.usd || "",
      record.provider || record.note || "Payment",
      record.transactionId || "",
      accountingReference(record),
      invoiceStatus(record),
      customFieldsText(record.customFields)
    ];
  }
  if (preset === "misa_basic") {
    return [
      record.date || "",
      record.customerName || "",
      accountingReference(record),
      record.product || "",
      record.usd || "",
      accountingNotes(record),
      vnd(a.grossVnd),
      rate || "",
      invoiceNo,
      invoiceDate
    ];
  }
  return [
    record.date || "",
    record.customerName || "",
    record.customerEmail || "",
    record.product || "",
    record.usd || "",
    vnd(a.grossVnd),
    record.currency || "USD",
    record.provider || record.note || "Payment",
    record.transactionId || "",
    accountingReference(record),
    record.subscriptionId || record.billingAgreementId || "",
    invoiceNo,
    invoiceDate,
    accountingNotes(record)
  ];
}

function accountingRow(record = formData()) {
  return accountingExportValues(record, activeAccountingPreset()).join("\t");
}

function invoiceDraftText(record = formData()) {
  if (!record || !(record.customerName || record.customerEmail || record.usd || record.product)) return t("invoiceDraftMissing");
  const a = accounting(record);
  const rows = [
    [t("invoiceDraftTitle"), ""],
    [t("invoiceDraftCustomer"), record.customerName || ""],
    [t("invoiceDraftEmail"), record.customerEmail || ""],
    [t("invoiceDraftProduct"), record.product || ""],
    [t("invoiceDraftAmountUsd"), record.usd || ""],
    [t("invoiceDraftAmountVnd"), vnd(a.grossVnd)],
    [t("invoiceDraftProvider"), record.provider || record.note || "Payment"],
    [t("invoiceDraftReference"), accountingReference(record)],
    [t("invoiceDraftInvoiceNo"), el.invoiceNo.value.trim() || record.invoiceNo || ""],
    [t("invoiceDraftInvoiceDate"), el.invoiceDate.value.trim() || record.invoiceDate || ""],
    [t("invoiceDraftNotes"), accountingNotes(record)]
  ];
  return rows.map(([label, value]) => value ? `${label}: ${value}` : label).join("\n");
}

function updateInvoiceDraftPreview(record = formData()) {
  if (!el.invoiceDraftPreview) return;
  const text = invoiceDraftText(record);
  const lines = text.split(/\n/).filter(Boolean);
  const title = lines.shift() || t("invoiceDraftTitle");
  el.invoiceDraftPreview.innerHTML = `<strong>${escapeHtml(title)}</strong>${lines.map((line) => {
    const parts = line.split(/:\s*/);
    const label = parts.shift() || "";
    const value = parts.join(": ");
    return `<div><span>${escapeHtml(label)}</span><b>${escapeHtml(value || "-")}</b></div>`;
  }).join("")}`;
}

function updateAccountingPreview(record = formData()) {
  if (!el.accountingRowPreview) return;
  el.accountingRowPreview.value = accountingRow(record);
  updateInvoiceDraftPreview(record);
  if (el.accountingDraftStatus) el.accountingDraftStatus.textContent = record.accountingExportedAt ? t("accountingExportMarked") : t("accountingDraftReady");
}

function makeAllRows() {
  if (!records.length) return "";
  records[activeIndex] = formData();
  let invoiceNo = el.invoiceNo.value.trim();
  const invoiceDate = el.invoiceDate.value.trim();
  return records.map((record) => {
    const row = makeRow(record, invoiceNo, invoiceDate);
    if (el.autoIncrementInvoice.checked && invoiceNo) invoiceNo = incrementInvoice(invoiceNo);
    return row;
  }).join("\n");
}

function collectSheetFieldWrites(existing = {}) {
  const writes = { ...existing };
  document.querySelectorAll("[data-write-field]").forEach((button) => {
    const key = button.dataset.writeField;
    if (!key) return;
    writes[key] = button.dataset.state !== "off";
  });
  return writes;
}

function renderSheetFieldWriteToggles(record = {}) {
  const writes = sheetFieldWritesFor(record);
  document.querySelectorAll("[data-write-field]").forEach((button) => {
    const key = button.dataset.writeField;
    const enabled = writes[key] !== false;
    button.dataset.state = enabled ? "on" : "off";
    button.textContent = enabled ? t("sheetFieldWriteOn") : t("sheetFieldWriteOff");
    button.title = enabled
      ? (config.language === "en" ? "This field will be written to Google Sheets." : "Trường này sẽ được ghi vào Google Sheet.")
      : (config.language === "en" ? "This field stays visible here but will not be written." : "Trường này vẫn hiện ở đây nhưng không ghi vào Sheet.");
  });
}

function formData() {
  const d = records[activeIndex] || {};
  Object.keys(el.fields).forEach((key) => {
    d[key] = el.fields[key].value.trim();
  });
  const typedProduct = el.customProductName ? el.customProductName.value.trim() : "";
  d.product = typedProduct || el.product.value || d.product || guessProduct(d.usd);
  d.note = d.note || d.provider || "Payment";
  if (el.shouldWriteRevenue) {
    d.shouldWriteToRevenueSheet = el.shouldWriteRevenue.checked;
    d.manualRevenueOverride = el.shouldWriteRevenue.checked && !["Paid", "Refund"].includes(d.status);
  }
  d.confidence = d.confidence || {};
  d.sheetFieldWrites = collectSheetFieldWrites(d.sheetFieldWrites);
  d.customFields = collectCustomFields();
  records[activeIndex] = d;
  return d;
}

function collectCustomFields() {
  if (!el.customFieldsList) return cleanCustomFields(records[activeIndex] && records[activeIndex].customFields);
  return cleanCustomFields(Array.from(el.customFieldsList.querySelectorAll("[data-custom-field-card]")).map((row) => ({
    name: row.querySelector("[data-custom-name]")?.value || "",
    value: row.querySelector("[data-custom-value]")?.value || "",
    writeToSheet: row.querySelector("[data-custom-write]")?.dataset.state !== "off"
  })));
}

function renderCustomFields(fields = []) {
  if (!el.customFieldsList) return;
  const rows = cleanCustomFields(fields);
  if (el.customFieldsCount) el.customFieldsCount.textContent = rows.length ? tf("customFieldsCount", { count: rows.length }) : "";
  el.customFieldsList.innerHTML = rows.map((field, index) => `
    <label class="adaptive-field-card" data-custom-field-card data-index="${index}">
      <input data-custom-name class="adaptive-field-name" value="${escapeHtml(customFieldDisplayName(field.name))}" placeholder="${escapeHtml(t("customFieldNamePlaceholder"))}">
      <button class="field-write-toggle adaptive-field-write" type="button" data-custom-write data-state="${field.writeToSheet ? "on" : "off"}">${escapeHtml(field.writeToSheet ? t("sheetFieldWriteOn") : t("sheetFieldWriteOff"))}</button>
      <input data-custom-value value="${escapeHtml(field.value)}" placeholder="${escapeHtml(t("customFieldValuePlaceholder"))}">
      <button type="button" class="custom-field-remove" data-index="${index}">×</button>
    </label>
  `).join("");
}

function renderCustomFieldsSheetControls() {
  if (!el.customFieldsSheetColumn || !el.writeCustomFields) return;
  el.writeCustomFields.checked = true;
  el.customFieldsSheetColumn.disabled = false;
}

async function applySheetColumnPreset(columns, message) {
  applySheetFieldColumnsToInputs(columns);
  config.sheetFieldColumns = normalizeSheetFieldColumns(columns);
  updateRow();
  await saveConfig();
  setSheetFeedback(message || t("saveSettings"), "success");
}

function renderForm(d = {}) {
  Object.keys(el.fields).forEach((key) => {
    el.fields[key].value = d[key] || "";
  });
  fillProductOptions();
  if (d.product && !REVIEW_PRODUCT_PATTERN.test(d.product) && !Array.from(el.product.options).some((option) => option.value === d.product)) {
    addProductRuleItem(d.product, d.usd, { select: false });
  }
  el.product.value = d.product && !REVIEW_PRODUCT_PATTERN.test(d.product) ? d.product : "";
  if (el.customProductName) el.customProductName.value = d.product && !REVIEW_PRODUCT_PATTERN.test(d.product) ? d.product : "";
  if (el.reviewProvider) el.reviewProvider.value = d.provider || d.note || t("unknownLabel");
  if (el.reviewEmailType) el.reviewEmailType.value = displayEmailType(d.emailType || d.type || "unknown");
  if (el.reviewStatus) el.reviewStatus.value = displayRecordStatus(d.status || "Info");
  if (el.reviewRevenueImpact) el.reviewRevenueImpact.value = displayRevenueImpact(d.revenueImpact || "none");
  if (el.shouldWriteRevenue) el.shouldWriteRevenue.checked = d.shouldWriteToRevenueSheet === true;
  if (el.revenueWriteReason) {
    const writable = d.shouldWriteToRevenueSheet === true;
    el.revenueWriteReason.dataset.state = writable ? "writable" : "blocked";
    el.revenueWriteReason.textContent = d.writableReason || (writable
      ? t("canWriteAfterReview")
      : t("notSuccessfulPaymentReason"));
  }
  renderSheetFieldWriteToggles(d);
  renderCustomFields(d.customFields || []);
  renderCustomFieldsSheetControls();
  renderConfidence(d);
  renderWarnings(d);
  updateRow();
  updateAccountingPreview(d);
  renderSmartSuggestions(d);
  renderReviewSummary(d);
}

function renderReviewSummary(d = {}) {
  if (!el.reviewSummaryCard) return;
  const hasData = Boolean(d.customerName || d.customerEmail || d.orderNo || d.usd || d.transactionId);
  el.reviewSummaryCard.hidden = !hasData;
  if (!hasData) {
    el.reviewSummaryCard.innerHTML = "";
    return;
  }
  const state = smartRecordState(d);
  const status = state === "saved" ? t("reviewSummarySaved")
    : state === "duplicate" ? t("reviewSummaryDuplicate")
      : state === "review" ? t("reviewSummaryNeedsReview")
        : t("reviewSummaryReady");
  el.reviewSummaryCard.dataset.state = state;
  el.reviewSummaryCard.innerHTML = `
    <div>
      <small>${escapeHtml(t("reviewSummaryTitle"))}</small>
      <strong>${escapeHtml(d.customerName || d.customerEmail || d.orderNo || "Payment")}</strong>
    </div>
    <div><small>USD</small><strong>${escapeHtml(d.usd || d.amountUsd || "-")}</strong></div>
    <div><small>${escapeHtml(t("providerLabel"))}</small><strong>${escapeHtml(d.provider || d.note || "Payment")}</strong></div>
    <div><span class="summary-state ${escapeHtml(state)}">${escapeHtml(status)}</span></div>
  `;
}

function isRevenueWritable(record, options = {}) {
  return Boolean(globalThis.RevenueFlowRules && RevenueFlowRules.isRevenueWritable(record, options));
}

function renderRecordSelector() {
  el.recordSelect.hidden = records.length <= 1;
  if (records.length <= 1) return;
  el.recordSelect.innerHTML = records.map((record, index) => {
    const label = `${index + 1}. ${record.customerName || record.orderNo || record.usd || "PayPal"}${record.usd ? ` - ${record.usd} USD` : ""}`;
    return `<option value="${index}">${escapeHtml(label)}</option>`;
  }).join("");
  el.recordSelect.value = String(activeIndex);
}

function recordDisplayName(record = {}) {
  return record.customerName || record.customerEmail || record.orderNo || record.transactionId || "Payment";
}

function recordReference(record = {}) {
  return record.transactionId || record.orderNo || record.profileId || record.subscriptionId || record.sourceMessageId || "";
}

function prettifyKey(value = "") {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function displayRevenueImpact(value = "none") {
  const key = String(value || "none").toLowerCase();
  if (key === "positive") return t("revenueImpactPositive");
  if (key === "negative") return t("revenueImpactNegative");
  if (key === "risk_negative") return t("revenueImpactRiskNegative");
  return t("revenueImpactNone");
}

function displayRecordStatus(value = "Info") {
  const key = String(value || "Info").toLowerCase();
  if (key === "paid") return t("recordStatusPaid");
  if (key === "refund" || key === "refunded") return t("recordStatusRefund");
  if (key === "pending") return t("recordStatusPending");
  if (key === "failed") return t("recordStatusFailed");
  if (key === "dispute" || key === "chargeback") return t("recordStatusDispute");
  if (key === "info") return t("recordStatusInfo");
  return prettifyKey(value);
}

function displayEmailType(value = "unknown") {
  const key = String(value || "unknown").toLowerCase();
  if (["successful_payment", "payment received", "payment_received", "recurring_payment_success", "invoice_paid"].includes(key)) return t("emailTypePaid");
  if (["payment_failed", "recurring_payment_failed"].includes(key)) return t("emailTypeFailed");
  if (key === "refund") return t("emailTypeRefund");
  if (["dispute", "chargeback"].includes(key)) return t("emailTypeDispute");
  if (key.startsWith("subscription_") || key.startsWith("trial_") || key.includes("recurring")) return t("emailTypeSubscription");
  if (key === "unknown" || key === "info") return t("emailTypeInfo");
  return prettifyKey(value);
}

function paymentRecordKey(record = {}) {
  const provider = String(record.provider || record.note || "payment").toLowerCase();
  const transaction = String(record.transactionId || "").trim().toLowerCase();
  const profile = String(record.profileId || "").trim().toLowerCase();
  const order = String(record.orderNo || "").trim().toLowerCase();
  if (transaction) return `${provider}:tx:${transaction}`;
  if (profile) return `${provider}:profile:${profile}`;
  if (order) return `${provider}:order:${order}`;
  return `${provider}:fallback:${String(record.customerEmail || "").trim().toLowerCase()}:${moneyNumber(record.amountUsd || record.usd || 0)}:${record.date || ""}`;
}

function paymentDuplicateKeys(record = {}) {
  const provider = String(record.provider || record.note || "payment").toLowerCase();
  const transaction = String(record.transactionId || "").trim().toLowerCase();
  const profile = String(record.profileId || record.subscriptionId || "").trim().toLowerCase();
  const order = String(record.orderNo || "").trim().toLowerCase();
  const email = String(record.customerEmail || "").trim().toLowerCase();
  const name = String(record.customerName || "").trim().toLowerCase().replace(/\s+/g, " ");
  const amount = moneyNumber(record.amountUsd || record.usd || 0).toFixed(2);
  const date = String(record.date || "").trim();
  return [
    transaction && `${provider}:tx:${transaction}`,
    profile && `${provider}:profile:${profile}`,
    order && `${provider}:order:${order}`,
    email && amount !== "0.00" && date && `${provider}:email-amount-date:${email}:${amount}:${date}`,
    name && amount !== "0.00" && date && `${provider}:name-amount-date:${name}:${amount}:${date}`
  ].filter(Boolean);
}

function annotateDuplicateRecords(list) {
  const seen = new Set();
  const historyKeys = new Set(historyItems.flatMap((item) => paymentDuplicateKeys(item)));
  return list.map((record) => {
    const keys = paymentDuplicateKeys(record);
    const inHistory = keys.some((key) => historyKeys.has(key));
    record.isDuplicate = keys.some((key) => seen.has(key)) || inHistory;
    if (record.isDuplicate) {
      record.needReview = true;
      record.reviewReasons = [...new Set([...(record.reviewReasons || []), t("possibleDuplicateTransaction")])] ;
    }
    keys.forEach((key) => seen.add(key));
    return record;
  });
}

function recordDate(record = {}) {
  const direct = String(record.date || "").match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})/);
  if (direct) return new Date(Number(direct[3]), Number(direct[2]) - 1, Number(direct[1]));
  const parsed = new Date(record.receivedAt || record.createdAt || "");
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function uniqueRevenueRecords() {
  const map = new Map();
  [...historyItems, ...bridgeQueueRecords].forEach((record) => {
    const key = paymentRecordKey(record);
    const existing = map.get(key);
    map.set(key, existing ? { ...record, ...existing, isDuplicate: Boolean(record.isDuplicate || existing.isDuplicate) } : record);
  });
  return [...map.values()];
}

function renderRevenueDashboard() {
  const unique = uniqueRevenueRecords();
  const now = new Date();
  const thisMonth = unique.filter((record) => {
    const date = recordDate(record);
    return date && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  el.monthRevenue.textContent = `$${thisMonth.reduce((sum, record) => sum + moneyNumber(record.amountUsd || record.usd), 0).toFixed(2)}`;
  el.dashboardPaymentCount.textContent = String(unique.length);
  el.dashboardDuplicateCount.textContent = String(bridgeQueueRecords.filter((record) => record.isDuplicate).length);
  const months = Array.from({ length: 6 }, (_, offset) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - offset), 1);
    const value = unique.reduce((sum, record) => {
      const recordValue = recordDate(record);
      return recordValue && recordValue.getFullYear() === date.getFullYear() && recordValue.getMonth() === date.getMonth()
        ? sum + moneyNumber(record.amountUsd || record.usd) : sum;
    }, 0);
    return { label: date.toLocaleDateString(config.language === "en" ? "en-US" : "vi-VN", { month: "short" }), value };
  });
  const max = Math.max(...months.map((month) => month.value), 1);
  el.revenueChart.innerHTML = months.map((month) => `<div class="chart-month"><div class="chart-value">$${month.value.toFixed(0)}</div><div class="chart-track"><span style="height:${Math.max(4, (month.value / max) * 100)}%"></span></div><small>${escapeHtml(month.label)}</small></div>`).join("");
}

function fillProviderFilter() {
  const selected = el.providerFilter.value || "all";
  const providers = [...new Set(bridgeQueueRecords.map((record) => record.provider || record.note || "Payment"))];
  el.providerFilter.innerHTML = `<option value="all">${escapeHtml(t("providerAll"))}</option>` + providers.map((provider) => `<option value="${escapeHtml(provider)}">${escapeHtml(provider)}</option>`).join("");
  el.providerFilter.value = providers.includes(selected) ? selected : "all";
}

function emailTypeGroup(record) {
  const type = String(record.emailType || record.type || "unknown");
  if (["successful_payment", "recurring_payment_success", "invoice_paid"].includes(type)) return "paid";
  if (["payment_failed", "recurring_payment_failed"].includes(type)) return "failed";
  if (type === "refund") return "refund";
  if (["dispute", "chargeback"].includes(type)) return "dispute";
  if (type.startsWith("subscription_") || type.startsWith("trial_")) return "subscription";
  return "info";
}

function renderEmailTypeFilters() {
  if (!el.emailTypeFilter) return;
  const selected = el.emailTypeFilter.value || "all";
  const options = ["all", "paid", "failed", "refund", "dispute", "subscription", "info"];
  const labelsByType = {
    all: t("emailTypeAll"),
    paid: t("emailTypePaid"),
    failed: t("emailTypeFailed"),
    refund: t("emailTypeRefund"),
    dispute: t("emailTypeDispute"),
    subscription: t("emailTypeSubscription"),
    info: t("emailTypeInfo")
  };
  el.emailTypeFilter.innerHTML = options.map((value) => `<option value="${value}">${escapeHtml(labelsByType[value] || value)}</option>`).join("");
  el.emailTypeFilter.value = options.includes(selected) ? selected : "all";
}

function isRecordWrittenToSheet(record) {
  if (record && record.writtenToSheet && (record.sheetWrittenAt || record.sheetRange)) return true;
  const key = paymentRecordKey(record);
  return historyItems.some((item) => item.writtenToSheet && item.sheetVerifiedAt && paymentRecordKey(item) === key);
}

function activeSmartFilter() {
  const active = el.smartInboxFilters && el.smartInboxFilters.querySelector(".smart-filter.active");
  return active ? active.dataset.statusFilter || "all" : "all";
}

function smartRecordState(record) {
  if (isRecordWrittenToSheet(record)) return "saved";
  if (record.isDuplicate) return "duplicate";
  if (record.needReview) return "review";
  if (record.shouldWriteToRevenueSheet === true) return "ready";
  return "new";
}

function smartRecordStateLabel(state) {
  if (state === "saved") return t("smartFilterSaved");
  if (state === "duplicate") return t("smartFilterDuplicate");
  if (state === "review") return t("smartFilterReview");
  if (state === "ready") return t("smartFilterReady");
  return t("inboxNew");
}

function readyBulkRecords() {
  return bridgeQueueRecords
    .filter((record) => smartRecordState(record) === "ready" && record.shouldWriteToRevenueSheet === true)
    .filter((record) => !isRecordWrittenToSheet(record));
}

function paymentQueueStats() {
  const stats = { total: bridgeQueueRecords.length, ready: 0, review: 0, duplicate: 0, saved: 0, new: 0 };
  bridgeQueueRecords.forEach((record) => {
    const state = smartRecordState(record);
    if (Object.prototype.hasOwnProperty.call(stats, state)) stats[state] += 1;
  });
  return stats;
}

function queueSummaryText(stats = paymentQueueStats()) {
  const next = stats.ready > 0
    ? t("queueNextSave")
    : stats.review > 0
      ? t("queueNextReview")
      : stats.duplicate > 0
        ? t("queueNextDuplicate")
        : stats.total > 0
          ? t("queueNextDone")
          : t("queueNextScan");
  return `${t("queueSummaryText")
    .replace("{ready}", String(stats.ready || 0))
    .replace("{review}", String(stats.review || 0))
    .replace("{duplicate}", String(stats.duplicate || 0))
    .replace("{saved}", String(stats.saved || 0))} · ${next}`;
}

function updateBulkReadyBar() {
  if (!el.bulkReadyBar) return;
  const ready = readyBulkRecords();
  const stats = paymentQueueStats();
  el.bulkReadyCount.textContent = String(ready.length);
  el.bulkReadyBar.hidden = ready.length === 0;
  if (el.bulkQueueSummary) {
    el.bulkQueueSummary.textContent = queueSummaryText(stats);
    el.bulkQueueSummary.hidden = stats.total === 0;
  }
}

function updateSmartFilterCounts() {
  if (!el.smartInboxFilters) return;
  const counts = { all: bridgeQueueRecords.length, ready: 0, review: 0, duplicate: 0, saved: 0 };
  bridgeQueueRecords.forEach((record) => {
    const state = smartRecordState(record);
    if (Object.prototype.hasOwnProperty.call(counts, state)) counts[state] += 1;
  });
  el.smartInboxFilters.querySelectorAll(".smart-filter").forEach((button) => {
    const key = button.dataset.statusFilter || "all";
    const labelKey = {
      all: "smartFilterAll",
      ready: "smartFilterReady",
      review: "smartFilterReview",
      duplicate: "smartFilterDuplicate",
      saved: "smartFilterSaved"
    }[key] || "smartFilterAll";
    button.innerHTML = `<span>${escapeHtml(t(labelKey))}</span><strong>${counts[key] || 0}</strong>`;
  });
}

function inboxScanSummary() {
  const summary = workflowContext.emailBridge && workflowContext.emailBridge.summary;
  if (summary && (summary.scannedCount || summary.matchedCount || summary.skippedNonRevenue)) {
    const base = t("inboxScanSummary")
      .replace("{scanned}", String(summary.scannedCount || 0))
      .replace("{matched}", String(summary.matchedCount ?? bridgeQueueRecords.length));
    const skipped = Number(summary.skippedNonRevenue || 0);
    return skipped ? `${base} · ${config.language === "en" ? "Skipped non-revenue" : "Bỏ qua không phải payment"}: ${skipped}` : base;
  }
  return t("inboxScanSummary")
    .replace("{scanned}", String(gmailScanStats.queried || 0))
    .replace("{matched}", String(bridgeQueueRecords.length));
}

function renderPaymentInbox(list = bridgeQueueRecords) {
  bridgeQueueRecords = annotateDuplicateRecords(Array.isArray(list) ? list : []);
  fillProviderFilter();
  renderEmailTypeFilters();
  const provider = el.providerFilter.value;
  const emailType = el.emailTypeFilter ? el.emailTypeFilter.value : "all";
  const sheetStatus = el.sheetStatusFilter ? el.sheetStatusFilter.value : "all";
  const statusFilter = activeSmartFilter();
  const visible = bridgeQueueRecords.map((record, index) => ({ record, index })).filter(({ record }) => {
    const providerMatch = provider === "all" || (record.provider || record.note || "Payment") === provider;
    const typeMatch = emailType === "all" || emailTypeGroup(record) === emailType;
    const written = isRecordWrittenToSheet(record);
    const smartMatch = statusFilter === "all" || smartRecordState(record) === statusFilter;
    const sheetMatch = sheetStatus === "all"
      || (sheetStatus === "written" && written)
      || (sheetStatus === "not_written" && !written && record.shouldWriteToRevenueSheet === true)
      || (sheetStatus === "not_revenue" && record.shouldWriteToRevenueSheet !== true);
    return providerMatch && typeMatch && sheetMatch && smartMatch;
  });
  el.paymentInboxCount.textContent = String(bridgeQueueRecords.length);
  el.paymentInboxScanSummary.textContent = inboxScanSummary();
  updateSmartFilterCounts();
  updateBulkReadyBar();
  el.paymentInboxEmpty.hidden = visible.length > 0;
  el.paymentInboxBody.innerHTML = visible.map(({ record, index }) => {
    const writtenToSheet = isRecordWrittenToSheet(record);
    const state = smartRecordState(record);
    const statusText = smartRecordStateLabel(state);
    const statusClass = state;
    const customer = recordDisplayName(record);
    const email = record.customerEmail ? `<small>${escapeHtml(record.customerEmail)}</small>` : "";
    const reference = recordReference(record);
    const amount = record.amountUsd || record.usd || "";
    const type = `${record.provider || t("unknownLabel")} · ${displayEmailType(record.emailType || record.paymentType || record.type || "unknown")} · ${record.shouldWriteToRevenueSheet === true ? t("willWriteSheet") : t("notRevenue")}`;
    return `
      <tr class="payment-inbox-row" data-index="${index}" tabindex="0">
        <td><span class="inbox-status ${statusClass}">${escapeHtml(statusText)}</span></td>
        <td>${escapeHtml(record.date || "-")}</td>
        <td><strong>${escapeHtml(customer)}</strong>${email}</td>
        <td><code>${escapeHtml(reference || "-")}</code></td>
        <td>${escapeHtml(amount ? `${amount}` : "-")}</td>
        <td>${escapeHtml(type)}</td>
      </tr>
    `;
  }).join("");
  renderRevenueDashboard();
  renderSetupChecklist();
}

function renderPaymentDetail(record = null) {
  if (!el.paymentDetailCard) return;
  if (!record) {
    el.paymentDetailCard.hidden = true;
    el.paymentDetailCard.innerHTML = "";
    return;
  }
  const reasons = [...new Set(record.reviewReasons || [])];
  const source = [record.rawFrom, record.provider || record.note].filter(Boolean).join(" · ") || "-";
  el.paymentDetailCard.hidden = false;
  el.paymentDetailCard.innerHTML = `
    <div class="payment-detail-head">
      <strong>${escapeHtml(t("paymentDetailTitle"))}</strong>
      <span class="inbox-status ${escapeHtml(smartRecordState(record))}">${escapeHtml(smartRecordStateLabel(smartRecordState(record)))}</span>
    </div>
    <div class="payment-detail-grid">
      <div><small>${escapeHtml(t("paymentDetailSource"))}</small><span>${escapeHtml(source)}</span></div>
      <div><small>${escapeHtml(t("paymentDetailRaw"))}</small><span>${escapeHtml(record.rawSubject || "-")}</span></div>
      <div><small>Transaction</small><span>${escapeHtml(record.transactionId || "-")}</span></div>
      <div><small>${escapeHtml(t("paymentDetailReason"))}</small><span>${escapeHtml(reasons.length ? reasons.join(" · ") : smartRecordStateLabel(smartRecordState(record)))}</span></div>
    </div>
  `;
}

function selectBridgeInboxRecord(index) {
  const selected = bridgeQueueRecords[index];
  if (!selected) return;
  renderPaymentDetail(selected);
  const paymentRecord = normalizeBridgeRecordToPaymentRecord(selected);
  workflowContext.paymentRecord = paymentRecord;
  records = [paymentRecord];
  activeIndex = 0;
  renderRecordSelector();
  renderForm(paymentRecord);
  setBridgeStatus(t("bridgeStatusImported"), selected.needReview ? "warning" : "success");
  setStatus(selected.needReview
    ? (config.language === "en" ? "Payment selected. Review the highlighted fields before writing to Sheet." : "Đã chọn payment. Kiểm tra các trường cần chú ý trước khi ghi Sheet.")
    : (config.language === "en" ? "Payment selected. Review it, then write to Sheet." : "Đã chọn payment. Kiểm tra rồi ghi vào Sheet."),
    selected.needReview ? "warning" : "success"
  );
}

function renderConfidence(d) {
  const checks = d.confidence || {};
  const items = [
    [config.language === "en" ? "Type" : "Loại", checks.type],
    [config.language === "en" ? "Name" : "Tên", checks.customerName],
    ["Email", checks.customerEmail],
    ["Order", checks.orderNo],
    ["USD", checks.usd],
    [config.language === "en" ? "Product" : "Sản phẩm", checks.product]
  ];
  const okCount = items.filter((item) => item[1] && item[1].ok).length;
  el.confidenceBadge.textContent = `${okCount}/${items.length} ${t("reliable")}`;
  el.confidenceList.textContent = items.map(([name, item]) => `${name}: ${item && item.ok ? item.source || "OK" : t("needsReview")}`).join(" · ");
}

function renderWarnings(d) {
  const missing = missingFields(d);
  Object.entries(el.fields).forEach(([key, input]) => input.classList.toggle("missing", !["orderNo", "profileId", "transactionId"].includes(key) && !d[key]));
  el.product.classList.toggle("missing", !d.product);
  el.forceCopy.hidden = !(missing.length && currentRow);
  if (!missing.length) {
    el.warnings.hidden = true;
    el.warnings.textContent = "";
    renderReviewReadiness(d, missing);
    return;
  }
  el.warnings.hidden = false;
  el.warnings.textContent = config.language === "en" ? `Needs review: ${missing.join(", ")}.` : `Cần kiểm tra: ${missing.join(", ")}.`;
  renderReviewReadiness(d, missing);
}

function renderSheetPreflight(d = {}, parts = buildSheetRowParts(d)) {
  if (!el.sheetPreflightWarnings) return;
  const issues = [];
  const missing = missingFields(d);
  if (missing.length) issues.push(tf("sheetPreflightMissing", { fields: missing.join(", ") }));
  if (d.isDuplicate && !d.duplicateApproved) issues.push(t("sheetPreflightDuplicate"));
  if (!spreadsheetIdFromUrl(el.sheetUrl && el.sheetUrl.value)) issues.push(t("sheetPreflightNoSheet"));
  if (parts.warnings && parts.warnings.beforeStart) issues.push(t("sheetPreflightColumnBeforeStart"));
  if (parts.warnings && parts.warnings.invalidStart) issues.push(t("invalidStartCell"));
  el.sheetPreflightWarnings.hidden = !issues.length;
  el.sheetPreflightWarnings.innerHTML = issues.length
    ? `<strong>${escapeHtml(t("sheetPreflightTitle"))}</strong><ul>${issues.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
}

function renderSheetPreview(d = {}) {
  if (!el.sheetPreviewTable) return;
  const parts = buildSheetRowParts(d);
  const visible = parts.preview.filter((item) => String(item.value || "").trim());
  const rows = (visible.length ? visible : parts.preview.slice(0, 5)).map((item) => `
    <div class="sheet-preview-row">
      <button class="sheet-preview-col" type="button" data-sheet-field="${escapeHtml(item.key || "")}" data-current-column="${escapeHtml(item.column)}" title="${escapeHtml(t("sheetPreviewEditHint"))}">${escapeHtml(item.column)}</button>
      <span title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
      <span title="${escapeHtml(item.value || "-")}">${escapeHtml(item.value || "-")}</span>
    </div>
  `).join("");
  el.sheetPreviewTable.innerHTML = rows;
  renderSheetPreflight(d, parts);
}

function editSheetPreviewColumn(key, currentColumn, label) {
  if (!key) return;
  const nextRaw = window.prompt(tf("sheetColumnPrompt", { field: label || key }), currentColumn || "");
  if (nextRaw === null) return;
  const next = sanitizeSheetColumn(nextRaw, "");
  if (!next) {
    setStatus(t("sheetColumnInvalid"), "warning");
    return;
  }
  if (key === "customFields") {
    if (el.customFieldsSheetColumn) el.customFieldsSheetColumn.value = next;
  } else if (el.sheetColumnInputs && el.sheetColumnInputs[key]) {
    el.sheetColumnInputs[key].value = next;
  }
  config.sheetFieldColumns = collectSheetFieldColumns();
  updateRow();
  scheduleSaveConfig();
  setStatus(tf("sheetColumnUpdated", { field: label || key, column: next }), "success");
}

function renderReviewReadiness(d = {}, missing = missingFields(d)) {
  if (!records.length) {
    el.reviewReadiness.dataset.state = "empty";
    el.reviewReadiness.textContent = t("reviewSelectPayment");
    return;
  }
  if (d.reviewAccepted) {
    el.reviewReadiness.dataset.state = "accepted";
    el.reviewReadiness.innerHTML = `<strong>${escapeHtml(t("reviewAccepted"))}</strong><p>${escapeHtml(config.language === "en" ? "Warnings stay visible, but this payment can be copied or saved." : "Cảnh báo vẫn hiển thị, nhưng payment này có thể copy hoặc lưu.")}</p>`;
    return;
  }
  if (missing.length) {
    el.reviewReadiness.dataset.state = "review";
    const duplicateAction = d.isDuplicate && !d.duplicateApproved ? `<button class="ghost confirm-duplicate" type="button">${escapeHtml(t("confirmDuplicate"))}</button>` : "";
    el.reviewReadiness.innerHTML = `<strong>${escapeHtml(t("reviewBlocked"))}</strong><p>${escapeHtml(d.isDuplicate && !d.duplicateApproved ? t("reviewDuplicateHelp") : missing.join(", "))}</p>${duplicateAction}`;
    return;
  }
  el.reviewReadiness.dataset.state = "ready";
  el.reviewReadiness.innerHTML = `<strong>${escapeHtml(t("reviewReady"))}</strong><p>${escapeHtml(t("reviewReadyHelp"))}</p>`;
}

function updateRow() {
  const d = formData();
  currentRow = makeRow(d);
  el.sheetRow.value = currentRow;
  updateAccountingPreview(d);
  renderSheetPreview(d);
  renderWarnings(d);
  renderSmartSuggestions(d);
}

async function readPageText() {
  // Chrome Web Store release: direct Gmail API scanning is the supported workflow.
  // The legacy active-tab Gmail scraping fallback is disabled to avoid requesting extra permissions.
  throw new Error(config.language === "en"
    ? "Legacy Gmail-tab reading is disabled in this release. Use Get new payments instead."
    : "Chế độ đọc tab Gmail cũ đã tắt trong bản phát hành. Hãy dùng Lấy payment mới.");
}

async function getUsdRate() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RATE_API_TIMEOUT_MS);
  try {
    const res = await fetch(EXCHANGE_RATE_API_URL, { cache: "no-store", signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const value = Number(data && data.rates && data.rates.VND);
    if (!Number.isFinite(value) || value <= 0) throw new Error("USD/VND rate is missing.");
    return {
      value: Math.round(value),
      source: "open.er-api.com",
      updatedAt: data.time_last_update_utc || new Date().toISOString()
    };
  } catch (error) {
    const message = error && error.name === "AbortError"
      ? (config.language === "en" ? "Rate service timed out." : "Dịch vụ tỷ giá phản hồi quá lâu.")
      : (error && error.message ? error.message : String(error || ""));
    return {
      value: Number(el.rate.value || defaultConfig.rate),
      source: "Manual",
      error: message
    };
  } finally {
    clearTimeout(timer);
  }
}

function rateSourceText(rate) {
  const value = vnd(rate.value);
  const timeValue = rate.refreshedAt || rate.updatedAt || lastRateRefreshAt;
  const time = timeValue
    ? new Date(timeValue).toLocaleString(config.language === "en" ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
    : "";
  if (rate.source === "Manual") {
    return config.language === "en"
      ? `Using saved/manual rate: ${value}${time ? ` · checked ${time}` : ""}${rate.error ? ` (${rate.error})` : ""}`
      : `Đang dùng tỷ giá đã lưu/nhập tay: ${value}${time ? ` · kiểm tra ${time}` : ""}${rate.error ? ` (${rate.error})` : ""}`;
  }
  return config.language === "en"
    ? `Live rate ${rate.source}: ${value}${time ? ` · updated ${time}` : ""}`
    : `Tỷ giá realtime ${rate.source}: ${value}${time ? ` · cập nhật ${time}` : ""}`;
}

function renderRateStatus(rate = lastRateInfo) {
  const current = rate && Number(rate.value)
    ? rate
    : { value: moneyNumber(el.rate.value) || defaultConfig.rate, source: "Manual", refreshedAt: lastRateRefreshAt || "" };
  lastRateInfo = current;
  if (el.rateSource) el.rateSource.textContent = rateSourceText(current);
  if (el.liveRateValue) el.liveRateValue.textContent = vnd(current.value);
  if (el.liveRateStatus) {
    const timeValue = current.refreshedAt || current.updatedAt || lastRateRefreshAt;
    const time = timeValue
      ? new Date(timeValue).toLocaleTimeString(config.language === "en" ? "en-US" : "vi-VN", { hour: "2-digit", minute: "2-digit" })
      : "";
    const isManual = current.source === "Manual";
    el.liveRateStatus.dataset.state = isManual ? "manual" : "live";
    el.liveRateStatus.textContent = `${isManual ? t("rateManualFallbackShort") : t("rateLiveShort")}${time ? ` · ${time}` : ""}`;
  }
}

function setRateUiUpdating(isUpdating) {
  if (el.quickRefreshRate) el.quickRefreshRate.disabled = isUpdating;
  if (el.getRate) el.getRate.disabled = isUpdating;
  if (el.liveRateStatus && isUpdating) {
    el.liveRateStatus.dataset.state = "updating";
    el.liveRateStatus.textContent = t("rateUpdatingShort");
  }
}

async function refreshRate(options = {}) {
  if (rateRefreshPromise) return rateRefreshPromise;
  const silent = options.silent === true;
  rateRefreshPromise = (async () => {
    if (!silent) setBusy(true);
    setRateUiUpdating(true);
    try {
      if (!silent) setStatus(config.language === "en" ? "Updating live USD/VND rate..." : "Đang cập nhật tỷ giá USD/VND realtime...", "ready");
      const rate = await getUsdRate();
      el.rate.value = rate.value;
      lastRateRefreshAt = new Date().toISOString();
      lastRateInfo = { ...rate, refreshedAt: lastRateRefreshAt };
      renderRateStatus(lastRateInfo);
      updateRow();
      await saveConfig();
      if (!silent) {
        setStatus(rate.source === "Manual"
          ? (config.language === "en" ? "Live rate unavailable. Using saved/manual rate." : "Chưa lấy được tỷ giá realtime. Đang dùng tỷ giá đã lưu/nhập tay.")
          : (config.language === "en" ? "Live rate updated." : "Đã cập nhật tỷ giá realtime."),
          rate.source === "Manual" ? "warning" : "success");
      }
      return lastRateInfo;
    } catch (err) {
      if (!silent) setStatus(config.language === "en" ? `Rate update failed: ${err.message}` : `Lỗi cập nhật tỷ giá: ${err.message}`, "error");
      return lastRateInfo;
    } finally {
      setRateUiUpdating(false);
      if (!silent) setBusy(false);
      rateRefreshPromise = null;
    }
  })();
  return rateRefreshPromise;
}

async function ensureFreshRate(options = {}) {
  const force = options.force === true;
  const maxAgeMs = options.maxAgeMs ?? RATE_REFRESH_INTERVAL_MS;
  if (rateRefreshPromise) return rateRefreshPromise;
  const refreshedAt = lastRateInfo && (lastRateInfo.refreshedAt || lastRateInfo.updatedAt || lastRateRefreshAt);
  const refreshedTime = refreshedAt ? new Date(refreshedAt).getTime() : 0;
  const isFresh = refreshedTime && Date.now() - refreshedTime < maxAgeMs;
  if (!force && isFresh && lastRateInfo.source !== "Manual") return lastRateInfo;
  return refreshRate({ silent: options.silent !== false });
}

function markManualRateEdited() {
  lastRateRefreshAt = new Date().toISOString();
  lastRateInfo = {
    value: moneyNumber(el.rate.value) || defaultConfig.rate,
    source: "Manual",
    refreshedAt: lastRateRefreshAt
  };
  renderRateStatus(lastRateInfo);
}

function startRateAutoRefresh() {
  if (rateRefreshTimer) clearInterval(rateRefreshTimer);
  refreshRate({ silent: true });
  rateRefreshTimer = setInterval(() => {
    refreshRate({ silent: true });
  }, RATE_REFRESH_INTERVAL_MS);
}

function looksLikePayPal(text, parsed) {
  return /paypal/i.test(text) || Boolean(parsed.transactionId || parsed.profileId || parsed.usd);
}

function parseStripe(text) {
  const parsed = parsePayPal(text);
  const normalized = normalizeText(text);
  parsed.type = detectType(normalized) || "Payment received";
  parsed.customerName = find(normalized, [/Customer name\s*\n?\s*([^\n]+)/i, /Customer\s*\n?\s*([^\n<]+)/i, /Payment from\s+([^\n]+)/i]) || parsed.customerName;
  parsed.customerEmail = find(normalized, [/Customer email\s*\n?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, /Receipt email\s*\n?\s*([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i]) || parsed.customerEmail;
  parsed.orderNo = find(normalized, [/Invoice (?:number|ID)\s*:?\s*([A-Z0-9_-]+)/i, /Order (?:number|ID)\s*:?\s*([A-Z0-9_-]+)/i, /Payment Intent\s*:?\s*(pi_[A-Z0-9_]+)/i]) || parsed.orderNo;
  parsed.usd = find(normalized, [/Amount paid\s*\n?\s*\$?([0-9,.]+)\s*USD/i, /Amount\s*\n?\s*\$?([0-9,.]+)\s*USD/i, /Total\s*\n?\s*\$?([0-9,.]+)\s*USD/i]) || parsed.usd;
  parsed.transactionId = find(normalized, [/\b((?:pi|ch|py|in|cs)_[A-Z0-9_]+)\b/i, /Transaction ID\s*:?\s*([A-Z0-9_-]+)/i]) || parsed.transactionId;
  const stripeProduct = resolveProductName({ selected: el.product.value, amount: parsed.usd, text: normalized });
  parsed.product = stripeProduct.value;
  parsed.note = "Stripe";
  parsed.provider = "Stripe";
  parsed.confidence = {
    type: confidence(parsed.type, "Stripe keyword"), customerName: confidence(parsed.customerName, "Stripe customer pattern"),
    customerEmail: confidence(parsed.customerEmail, "email pattern"), orderNo: confidence(parsed.orderNo, "invoice/payment pattern"),
    usd: confidence(parsed.usd, "USD amount pattern"), product: confidence(parsed.product, stripeProduct.source)
  };
  return parsed;
}

function parsePaymentEmail(text, metadata = {}) {
  if (!globalThis.RevenueFlowRules) return null;
  const parsed = RevenueFlowRules.parsePaymentEmail(text, metadata, activeGatewayRules());
  if (!parsed || parsed.emailType === "unknown" && parsed.provider === "Unknown") return null;
  parsed.type = parsed.emailType;
  parsed.usd = parsed.usd || parsed.amount || "";
  parsed.amount = parsed.amount || parsed.usd || "";
  parsed.customFields = cleanCustomFields([...(parsed.customFields || []), ...autoCustomFieldsFromText(text)]);
  const resolvedProduct = resolveProductName({ emailProduct: parsed.product, amount: parsed.usd, text });
  parsed.product = resolvedProduct.value;
  parsed.note = parsed.provider === "Unknown" ? "Payment" : parsed.provider;
  parsed.confidence = {
    type: parsed.confidence && parsed.confidence.emailType,
    customerName: confidence(parsed.customerName, parsed.customerName ? "email pattern" : ""),
    customerEmail: confidence(parsed.customerEmail, parsed.customerEmail ? "email pattern" : ""),
    orderNo: confidence(parsed.orderNo, parsed.orderNo ? "reference pattern" : ""),
    usd: parsed.confidence && parsed.confidence.amount,
    product: confidence(parsed.product, resolvedProduct.source)
  };
  return parsed;
}

function currentGatewayRules() {
  if (!globalThis.RevenueFlowRules) return [];
  const parsed = RevenueFlowRules.parseGatewayRules(gatewayRules.length ? gatewayRules : config.gatewayRules);
  gatewayRules = parsed.rules.length ? parsed.rules : RevenueFlowRules.getDefaultGatewayRules();
  return gatewayRules;
}

function activeGatewayRules() {
  if (!globalThis.RevenueFlowRules) return [];
  return (config.ruleMode || "default") === "custom"
    ? currentGatewayRules()
    : RevenueFlowRules.getDefaultGatewayRules();
}

function migrateLegacyGatewayRules(sourceRulesText) {
  const defaults = RevenueFlowRules.getDefaultGatewayRules();
  const legacy = parsePaymentSourceRules(sourceRulesText || "");
  legacy.forEach((oldRule) => {
    const match = defaults.find((rule) => rule.name.toLowerCase() === String(oldRule.provider || "").toLowerCase());
    if (!match) return;
    match.senderDomains = [...new Set([...(match.senderDomains || []), ...(oldRule.domains || [])])];
    match.searchKeywords = [...new Set([...(match.searchKeywords || []), ...(oldRule.keywords || [])])];
  });
  return defaults;
}

function gmailSearchQueries() {
  const queries = activeGatewayRules().filter((rule) => rule.enabled).flatMap((rule) => {
    const terms = [...(rule.senderDomains || []).map((domain) => `from:(${domain})`), ...(rule.searchKeywords || []).map((keyword) => `"${keyword.replace(/"/g, "")}"`)];
    return terms.length ? [`newer_than:${GMAIL_SCAN_DAYS}d {${terms.join(" ")}}`] : [];
  });
  return [...new Set(queries)];
}

function gmailNoMatchMessage() {
  const checked = gmailScanStats.queried || 0;
  if (!checked) return t("bridgeLatestEmpty");
  return tf("noMatchedPaymentAfterScan", { checked });
}

function base64UrlDecode(value = "") {
  const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value).length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function stripGmailHtml(value) {
  return String(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/tr>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function gmailHeader(message, name) {
  const headers = message && message.payload && Array.isArray(message.payload.headers) ? message.payload.headers : [];
  const found = headers.find((header) => String(header.name || "").toLowerCase() === name.toLowerCase());
  return found ? found.value || "" : "";
}

function collectGmailParts(part, bucket = { plain: [], html: [] }) {
  if (!part) return bucket;
  if (part.body && part.body.data) {
    const decoded = base64UrlDecode(part.body.data);
    if (/text\/plain/i.test(part.mimeType || "")) bucket.plain.push(decoded);
    if (/text\/html/i.test(part.mimeType || "")) bucket.html.push(stripGmailHtml(decoded));
  }
  if (Array.isArray(part.parts)) part.parts.forEach((child) => collectGmailParts(child, bucket));
  return bucket;
}

function gmailMessageText(message) {
  const parts = collectGmailParts(message.payload);
  const body = parts.plain.join("\n\n").trim() || parts.html.join("\n\n").trim();
  const subject = gmailHeader(message, "Subject");
  const from = gmailHeader(message, "From");
  const date = message.internalDate ? new Date(Number(message.internalDate)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : gmailHeader(message, "Date");
  return [`Subject: ${subject}`, `From: ${from}`, `Date: ${date}`, "", body].join("\n");
}

function shouldIgnoreGmailPayment(subject, text) {
  return /receipt for your payment to|you sent a payment|your payment to|withdrawal/i.test(`${subject}\n${text}`);
}

function reviewReasonsForPayment(record) {
  const reasons = [];
  const vi = config.language === "vi";
  if (!record.customerName) reasons.push(vi ? "Thiếu tên khách hàng" : "Customer name missing");
  if (!record.customerEmail) reasons.push(vi ? "Thiếu email khách hàng" : "Customer email missing");
  if (!record.orderNo) reasons.push(vi ? "Thiếu mã đơn hàng/tham chiếu" : "Order/reference missing");
  if (!record.amountUsd) reasons.push(vi ? "Thiếu số tiền USD" : "USD amount missing");
  if (!record.product) reasons.push(vi ? "Chưa nhận diện được sản phẩm/dịch vụ" : "Product not detected");
  return reasons;
}

function parsedGmailPaymentToBridgeRecord(message, parsed, rawText) {
  const subject = gmailHeader(message, "Subject");
  const from = gmailHeader(message, "From");
  const amountUsd = parsed.usd || parsed.amount || "";
  const product = parsed.product || guessProduct(amountUsd);
  const reviewReasons = reviewReasonsForPayment({
    customerName: parsed.customerName,
    customerEmail: parsed.customerEmail,
    orderNo: parsed.orderNo,
    amountUsd,
    product
  });
  return {
    id: message.id,
    source: "directGmail",
    provider: parsed.provider || parsed.note || "Payment",
    emailType: parsed.emailType || parsed.type || "unknown",
    status: parsed.status || "Info",
    revenueImpact: parsed.revenueImpact || "none",
    shouldWriteToRevenueSheet: parsed.shouldWriteToRevenueSheet === true,
    writableReason: parsed.writableReason || "",
    date: parsed.date || todayVN(),
    customerName: parsed.customerName || "",
    customerEmail: parsed.customerEmail || "",
    orderNo: parsed.orderNo || "",
    amountUsd,
    transactionId: parsed.transactionId || "",
    profileId: parsed.profileId || "",
    billingAgreementId: parsed.billingAgreementId || "",
    subscriptionId: parsed.subscriptionId || "",
    nextPaymentDate: parsed.nextPaymentDate || "",
    currency: parsed.currency || "USD",
    customFields: cleanCustomFields(parsed.customFields || autoCustomFieldsFromText(rawText)),
    paymentType: parsed.type || `${parsed.provider || "Payment"} email`,
    product: product || "Need Review - Product not detected",
    needReview: reviewReasons.length > 0,
    reviewReasons,
    rawSubject: subject,
    rawFrom: from,
    gmailMessageId: message.id,
    receivedAt: message.internalDate ? new Date(Number(message.internalDate)).toISOString() : "",
    rawText
  };
}

async function gmailApi(token, path, params = {}) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const res = await fetchWithTimeout(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    throw new Error(config.language === "en" ? "Gmail returned an invalid response." : "Gmail trả về phản hồi không hợp lệ.");
  }
  if (!res.ok) {
    if (res.status === 401) await removeCachedGoogleToken(token);
    const message = data.error && data.error.message ? data.error.message : res.statusText;
    throw new Error(message || t("bridgeCheckFailed"));
  }
  return data;
}

async function scanGmailPayments() {
  return runWithGoogleToken(async (token) => {
    const profile = await gmailApi(token, "profile");
    await acceptGmailProfile(profile);
    const messageMap = new Map();
    for (const query of gmailSearchQueries()) {
      const list = await gmailApi(token, "messages", {
        q: query,
        maxResults: GMAIL_SCAN_LIMIT
      });
      (list.messages || []).forEach((message) => messageMap.set(message.id, message));
    }
    const messages = [...messageMap.values()]
      .slice(0, GMAIL_SCAN_LIMIT);
    gmailScanStats = { queried: messages.length, ignored: 0, unmatched: 0, matched: 0 };
    const scanned = [];
    for (const item of messages) {
      const message = await gmailApi(token, `messages/${encodeURIComponent(item.id)}`, { format: "full" });
      const raw = gmailMessageText(message);
      const subject = gmailHeader(message, "Subject");
      if (shouldIgnoreGmailPayment(subject, raw)) {
        gmailScanStats.ignored += 1;
        continue;
      }
      const parsed = parsePaymentEmail(raw, { from: gmailHeader(message, "From"), subject, sourceMessageId: message.id });
      if (!parsed) {
        gmailScanStats.unmatched += 1;
        continue;
      }
      scanned.push(parsedGmailPaymentToBridgeRecord(message, parsed, raw));
    }
    scanned.sort((a, b) => String(b.receivedAt || "").localeCompare(String(a.receivedAt || "")));
    const annotated = annotateDuplicateRecords(scanned);
    gmailScanStats.matched = annotated.length;
    return annotated;
  }, [GMAIL_READONLY_SCOPE]);
}

function renderGmailSyncStatus(recordsFromGmail = []) {
  const needReview = recordsFromGmail.filter((record) => record.needReview).length;
  const duplicates = recordsFromGmail.filter((record) => record.isDuplicate);
  const data = {
    ok: true,
    serviceState: recordsFromGmail.length ? (needReview ? "review" : "ready") : "ready",
    lastSyncAt: new Date().toISOString(),
    summary: {
      scannedCount: gmailScanStats.queried,
      matchedCount: recordsFromGmail.length,
      parsedCount: recordsFromGmail.length,
      writtenCount: 0,
      writableCount: recordsFromGmail.length - needReview,
      skippedDuplicates: duplicates.length,
      needReviewCount: needReview
    },
    records: recordsFromGmail,
    duplicates
  };
  renderEmailBridgeStatus(data);
  renderPaymentInbox(recordsFromGmail);
}

async function buildRows({ copy = false } = {}) {
  setBusy(true);
  try {
    setStatus(config.language === "en" ? "Reading email in Gmail..." : "Đang đọc email trong Gmail...", "ready");
    rawText = await readPageText();
    if (!rawText.trim()) throw new Error(config.language === "en" ? "Could not read the opened email." : "Không đọc được nội dung email đang mở.");

    setStatus(config.language === "en" ? "Extracting PayPal data..." : "Đang tách dữ liệu PayPal...", "ready");
    records = parseBlocks(rawText).map(parsePayPal);
    activeIndex = 0;
    if (!records.length || !looksLikePayPal(rawText, records[0])) throw new Error(config.language === "en" ? "No valid PayPal email detected." : "Không phát hiện email PayPal hợp lệ.");
    renderRecordSelector();

    setStatus(config.language === "en" ? "Updating live rate..." : "Đang cập nhật tỷ giá realtime...", "ready");
    await ensureFreshRate({ force: true, silent: true });

    renderForm(records[0]);
    const missing = missingFields(records[0]);
    const shouldCopy = copy && el.autoCopy.checked && (!missing.length || !el.strictValidation.checked);
    if (shouldCopy) await copyAndSave(false);
    else if (copy && !el.autoCopy.checked) setStatus(t("autoCopyOff"), missing.length ? "warning" : "success");
    else if (copy && missing.length) setStatus(config.language === "en" ? "Row built but not copied because data is missing." : "Đã tạo dòng nhưng chưa copy vì thiếu dữ liệu.", "warning");
    else setStatus(records.length > 1 ? (config.language === "en" ? `Extracted ${records.length} transactions. Showing the first one.` : `Đã tách ${records.length} giao dịch. Đang hiển thị giao dịch đầu tiên.`) : (config.language === "en" ? "Sheet row built." : "Đã tạo dòng Sheet."), missing.length ? "warning" : "success");
    await saveConfig();
  } catch (err) {
    setStatus(err.message || (config.language === "en" ? "There was an error processing the email." : "Có lỗi khi xử lý email."), "error");
  } finally {
    setBusy(false);
  }
}

function incrementInvoice(value) {
  const m = String(value || "").match(/^(\D*)(\d+)(\D*)$/);
  if (!m) return value;
  const next = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return `${m[1]}${next}${m[3]}`;
}

async function copyAndSave(force = false) {
  await ensureFreshRate({ force: true, silent: true });
  const d = formData();
  const missing = missingFields(d);
  if (el.autoWriteSheet.checked && d.isDuplicate && !d.duplicateApproved) {
    renderWarnings(d);
    setStatus(t("reviewDuplicateHelp"), "warning");
    return;
  }
  if (missing.length && el.strictValidation.checked && !force) renderWarnings(d);
  currentRow = makeRow(d);
  el.sheetRow.value = currentRow;
  const copied = await safeCopy(currentRow);
  if (!copied) return;
  let wroteSheet = false;
  if (el.autoWriteSheet.checked) {
    if (!isRevenueWritable(d, { automatic: true })) {
      setStatus(config.language === "en" ? "Auto-write stopped: this email is not verified revenue." : "Đã chặn tự ghi: email này không phải doanh thu đã xác nhận.", "warning");
      return;
    }
    wroteSheet = await writeRowsToSheet(currentRow);
    if (!wroteSheet) return;
  }
  addHistory(d, currentRow, { writtenToSheet: wroteSheet });
  if (el.autoIncrementInvoice.checked && el.invoiceNo.value.trim()) {
    el.invoiceNo.value = incrementInvoice(el.invoiceNo.value.trim());
  }
  await saveConfig();
  setStatus(
    wroteSheet
      ? t("copyAndWriteSuccess")
      : (missing.length ? (config.language === "en" ? "Copied as requested, but this row still needs review." : "Đã copy theo yêu cầu, nhưng dòng này có dữ liệu cần kiểm tra.") : (config.language === "en" ? "Sheet row copied." : "Đã copy dòng Sheet.")),
    missing.length ? "warning" : "success"
  );
}

async function copyAllRows(force = false) {
  if (!records.length) {
    setStatus(config.language === "en" ? "There are no transactions to copy." : "Chưa có giao dịch để copy.", "warning");
    return;
  }
  records[activeIndex] = formData();
  const missingCount = records.filter((record) => missingFields(record).length).length;
  if (el.autoWriteSheet.checked && records.some((record) => record.isDuplicate && !record.duplicateApproved)) {
    setStatus(t("reviewDuplicateHelp"), "warning");
    return;
  }
  if (missingCount && el.strictValidation.checked && !force) {
    setStatus(config.language === "en" ? `Copied with ${missingCount} row(s) still needing review.` : `Đã copy, còn ${missingCount} dòng cần kiểm tra.`, "warning");
  }
  await ensureFreshRate({ force: true, silent: true });
  const rows = makeAllRows();
  const copied = await safeCopy(rows);
  if (!copied) return;
  let wroteSheet = false;
  if (el.autoWriteSheet.checked) {
    if (records.some((record) => !isRevenueWritable(record, { automatic: true }))) {
      setStatus(config.language === "en" ? "Auto-write stopped because the list contains non-revenue events." : "Đã chặn tự ghi vì danh sách có email không phải doanh thu.", "warning");
      return;
    }
    wroteSheet = await writeRowsToSheet(rows);
    if (!wroteSheet) return;
  }
  rows.split("\n").forEach((row, index) => addHistory(records[index], row, { writtenToSheet: wroteSheet }));
  if (el.autoIncrementInvoice.checked && el.invoiceNo.value.trim()) {
    for (let i = 0; i < records.length; i += 1) el.invoiceNo.value = incrementInvoice(el.invoiceNo.value.trim());
  }
  await saveConfig();
  setStatus(wroteSheet ? t("copyAllAndWriteSuccess") : (config.language === "en" ? `Copied ${records.length} Sheet rows.` : `Đã copy ${records.length} dòng Sheet.`), missingCount ? "warning" : "success");
}

function addHistory(d, row, { writtenToSheet = false } = {}) {
  const item = {
    id: Date.now(),
    createdAt: new Date().toISOString(),
    sheetVerifiedAt: writtenToSheet ? lastVerifiedSheetWriteAt : "",
    sheetTarget: writtenToSheet && lastVerifiedSheetWrite ? { ...lastVerifiedSheetWrite } : null,
    date: d.date || "",
    customerName: d.customerName,
    customerEmail: d.customerEmail,
    orderNo: d.orderNo,
    usd: d.usd,
    product: d.product,
    type: d.type,
    provider: d.provider || d.note || "Payment",
    note: d.note || d.provider || "Payment",
    transactionId: d.transactionId || "",
    profileId: d.profileId || "",
    writtenToSheet,
    row
  };
  historyItems = [item].concat(historyItems).slice(0, 50);
  renderHistory();
  renderPaymentInbox();
  storageSet({ historyItems });
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

async function copyText(text) {
  const value = String(text || "");
  if (!value) throw new Error(config.language === "en" ? "There is no content to copy." : "Không có nội dung để copy.");
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch (err) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!ok) throw err;
  }
}

async function safeCopy(text) {
  try {
    await copyText(text);
    return true;
  } catch (err) {
    setStatus(config.language === "en" ? "Automatic copy failed. Copy manually from the Google Sheet row box." : "Không copy được tự động. Hãy copy thủ công trong ô Dòng Google Sheet.", "error");
    return false;
  }
}

function rowValues(row) {
  return String(row || "").split("\t");
}

function getGoogleOAuthSetup() {
  if (typeof chrome === "undefined" || !chrome.runtime || !chrome.runtime.getManifest) {
    return { clientId: "", extensionId: "", missingChrome: true };
  }
  const manifest = chrome.runtime.getManifest();
  const oauth2 = manifest && manifest.oauth2 ? manifest.oauth2 : {};
  return {
    clientId: oauth2.client_id || "",
    extensionId: chrome.runtime.id || "",
    missingChrome: false
  };
}

function renderBuildIdentity() {
  const setup = getGoogleOAuthSetup();
  const manifest = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getManifest
    ? chrome.runtime.getManifest()
    : null;
  if (el.appVersion) el.appVersion.textContent = manifest && manifest.version ? `v${manifest.version}` : "";
  if (el.oauthExtensionId) el.oauthExtensionId.textContent = setup.extensionId || "-";
}

function showOAuthSetupCard(show = true) {
  if (!el.oauthSetupCard) return;
  renderBuildIdentity();
  el.oauthSetupCard.hidden = !show;
}

function isMissingOAuthClientId(clientId) {
  return !clientId || clientId.includes("PASTE_GOOGLE_OAUTH_CLIENT_ID_HERE") || clientId.includes("yourExtensionOAuthClientIDWillGoHere");
}

function setGoogleStatus(message = "", state = "ready") {
  el.googleStatus.textContent = message;
  el.googleStatus.dataset.state = state;
}

function renderGmailAccount(email = connectedGmail) {
  connectedGmail = String(email || "").trim();
  el.gmailAccountEmail.textContent = connectedGmail || t("gmailAccountDisconnected");
  el.gmailAccountEmail.dataset.connected = connectedGmail ? "true" : "false";
  el.connectGmailAccount.textContent = connectedGmail ? t("changeGmailAccount") : t("connectGmailAccount");
  if (!connectedGmail) el.accountSwitchHelp.hidden = true;
  el.sheetAccountHint.textContent = connectedGmail ? `${t("sheetAccountUsing")} ${connectedGmail}` : t("sheetAccountMissing");
  renderSetupChecklist();
}

function sheetAccessErrorMessage() {
  if (connectedGmail) {
    return config.language === "en"
      ? `This Sheet is not visible to ${connectedGmail}. Check the link and share the Sheet with this account as Editor.`
      : `Sheet này chưa được chia sẻ cho ${connectedGmail}. Hãy kiểm tra link và cấp quyền Người chỉnh sửa cho tài khoản này.`;
  }
  return t("googleSheetNotFound");
}

async function rememberGmailAccount(email) {
  renderGmailAccount(email);
  await storageSet({ gmailAccountEmail: connectedGmail });
}

function assertTargetGmailAccount(actualEmail) {
  const expected = String(el.targetGmailAccount.value || config.targetGmailAccount || "").trim().toLowerCase();
  const actual = String(actualEmail || "").trim().toLowerCase();
  if (expected && actual !== expected) {
    throw new Error(config.language === "en"
      ? `Connected to ${actual || "an unknown account"}, but this workspace is configured for ${expected}. Reconnect Gmail with the correct account.`
      : `Đang kết nối ${actual || "tài khoản không xác định"}, nhưng Gmail cần quét là ${expected}. Hãy kết nối lại Gmail bằng đúng tài khoản.`);
  }
}

async function acceptGmailProfile(profile) {
  const email = profile && profile.emailAddress ? profile.emailAddress : "";
  assertTargetGmailAccount(email);
  await rememberGmailAccount(email);
}

function googleSetupError() {
  const setup = getGoogleOAuthSetup();
  if (setup.missingChrome || typeof chrome === "undefined" || !chrome.identity || !chrome.identity.getAuthToken) {
    return t("googleSetupMissing");
  }
  if (isMissingOAuthClientId(setup.clientId)) {
    return t("googleSetupMissing");
  }
  return "";
}

function googleErrorText(error) {
  if (!error) return "No Google token";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const parts = [error.message, error.error, error.details, error.code, error.status].filter(Boolean).map(String);
    if (parts.length) return parts.join(" ");
    try {
      return JSON.stringify(error);
    } catch (err) {
      return Object.prototype.toString.call(error);
    }
  }
  return String(error);
}

function formatGoogleAuthError(error) {
  const raw = googleErrorText(error);
  const lower = raw.toLowerCase();
  if (lower.includes("verification process") || lower.includes("developer-approved tester") || lower.includes("test user") || lower.includes("app is currently being tested")) {
    return t("googleAccessBlocked");
  }
  if (lower.includes("bad client id") || lower.includes("invalid client") || lower.includes("unauthorized_client")) {
    showOAuthSetupCard(true);
    return t("googleBadClient");
  }
  if (lower.includes("not signed in") || lower.includes("signin") || lower.includes("sign-in")) {
    return t("googleSignedOut");
  }
  if (lower.includes("user did not approve")) {
    return t("googlePermissionDenied");
  }
  if (lower.includes("access_denied") || lower.includes("denied")) {
    return t("googleAccessBlocked");
  }
  return userFriendlyOAuthError(raw);
}

function getGoogleToken(interactive = true, requestedScopes = []) {
  const setupError = googleSetupError();
  if (setupError) {
    showOAuthSetupCard(true);
    return Promise.reject(new Error(setupError));
  }
  const tokenRequest = new Promise((resolve, reject) => {
    try {
      const details = { interactive, enableGranularPermissions: true };
      if (requestedScopes.length) details.scopes = requestedScopes;
      chrome.identity.getAuthToken(details, (token) => {
        const err = chrome.runtime.lastError;
        const tokenValue = token && typeof token === "object" ? token.token : token;
        const grantedScopes = token && typeof token === "object" && Array.isArray(token.grantedScopes) ? token.grantedScopes : [];
        const missingScopes = grantedScopes.length ? requestedScopes.filter((scope) => !grantedScopes.includes(scope)) : [];
        if (err || !tokenValue) {
          const sourceError = err || "No Google token";
          const authError = new Error(formatGoogleAuthError(sourceError));
          authError.oauthRaw = googleErrorText(sourceError);
          reject(authError);
        } else if (missingScopes.length) {
          const scopeError = new Error(missingScopes.includes(GOOGLE_SHEETS_SCOPE) ? t("googleSheetsScopeMissing") : t("googlePermissionDenied"));
          scopeError.googleScopeMissing = true;
          reject(scopeError);
        } else {
          resolve(tokenValue);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
  return withTimeout(tokenRequest, GOOGLE_AUTH_TIMEOUT_MS, t("googleConnectTimeout"));
}

function clearGoogleAuthCache() {
  const clearRequest = new Promise((resolve) => {
    if (typeof chrome === "undefined" || !chrome.identity || !chrome.identity.clearAllCachedAuthTokens) {
      resolve();
      return;
    }
    try {
      chrome.identity.clearAllCachedAuthTokens(() => resolve());
    } catch (err) {
      resolve();
    }
  });
  return withTimeout(clearRequest, GOOGLE_CACHE_TIMEOUT_MS, "").catch(() => undefined);
}

function removeCachedGoogleToken(token) {
  return new Promise((resolve) => {
    if (!token || typeof chrome === "undefined" || !chrome.identity || !chrome.identity.removeCachedAuthToken) {
      resolve();
      return;
    }
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

async function connectGoogle() {
  if (googleAuthInProgress) {
    setStatus(t("googleBusy"), "warning");
    return "";
  }
  googleAuthInProgress = true;
  el.connectGoogle.disabled = true;
  setGoogleStatus(t("googleConnecting"), "ready");
  setStatus(t("googleConnecting"), "ready");
  try {
    await clearGoogleAuthCache();
    const token = await getGoogleToken(true, [GMAIL_READONLY_SCOPE]);
    const profile = await gmailApi(token, "profile");
    await acceptGmailProfile(profile);
    showOAuthSetupCard(false);
    setOAuthUserLog(t("oauthLogConnected"), "success");
    setGoogleStatus(t("googleConnected"), "success");
    setStatus(t("googleConnected"), "success");
    return token;
  } catch (err) {
    const friendly = isCloudSyncMode()
      ? cloudSyncFriendlyError(err && err.message ? err.message : err)
      : isLocalEmailSyncMode()
        ? localEmailSyncFriendlyError(err && err.message ? err.message : err)
        : userFriendlyOAuthError(err);
    setOAuthUserLog(friendly, "error");
    setGoogleStatus(friendly, "error");
    setStatus(friendly, "error");
    return "";
  } finally {
    googleAuthInProgress = false;
    setGoogleConnectAvailable();
  }
}

async function connectGmailAccount() {
  if (connectedGmail) {
    el.accountSwitchHelp.hidden = !el.accountSwitchHelp.hidden;
    setStatus(t("accountSwitchHelp"), "warning");
    return;
  }
  if (googleAuthInProgress) {
    setStatus(t("googleBusy"), "warning");
    return;
  }
  googleAuthInProgress = true;
  el.connectGmailAccount.disabled = true;
  setStatus(config.language === "en" ? "Connecting Gmail..." : "Đang kết nối Gmail...", "ready");
  try {
    await clearGoogleAuthCache();
    const token = await getGoogleToken(true, [GMAIL_READONLY_SCOPE]);
    const profile = await gmailApi(token, "profile");
    await acceptGmailProfile(profile);
    const message = `${t("gmailAccountConnected")}: ${connectedGmail}`;
    setOAuthUserLog(t("oauthLogConnected"), "success");
    setGoogleStatus(message, "success");
    setStatus(message, "success");
    hideQuickFixActions();
  } catch (error) {
    renderGmailAccount("");
    const message = userFriendlyOAuthError(error);
    setOAuthUserLog(message, "error");
    setGoogleStatus(message, "error");
    setStatus(message, "error");
    showQuickFixActions("gmail");
  } finally {
    googleAuthInProgress = false;
    el.connectGmailAccount.disabled = false;
    setGoogleConnectAvailable();
  }
}

async function disconnectGmailAccount() {
  await clearGoogleAuthCache();
  connectedGmail = "";
  await storageSet({ gmailAccountEmail: "" });
  renderGmailAccount("");
  setOAuthUserLog("", "ready");
  setGoogleStatus(t("gmailDisconnected"), "ready");
  setStatus(t("gmailDisconnected"), "success");
}

function spreadsheetIdFromUrl(url) {
  const value = String(url || "").trim();
  if (/^[a-zA-Z0-9-_]{20,}$/.test(value)) return value;
  const match = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : "";
}

function sheetGidFromUrl(url) {
  const match = String(url || "").match(/[?#&]gid=(\d+)/i);
  return match ? Number(match[1]) : null;
}

function sheetUrlFromInput(value) {
  const raw = String(value || "").trim();
  const spreadsheetId = spreadsheetIdFromUrl(raw);
  if (!spreadsheetId) return "";
  if (/^https:\/\/docs\.google\.com\/spreadsheets\/d\//i.test(raw)) return raw;
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
}

function setSheetFeedback(message = "", state = "ready", options = {}) {
  if (!el.sheetActionStatus) return;
  el.sheetActionStatus.dataset.state = state;
  el.sheetActionStatus.hidden = !message;
  if (!message) {
    el.sheetActionStatus.innerHTML = "";
    return;
  }
  if (state === "success" && options.verifiedWrite && lastVerifiedSheetWrite && lastVerifiedSheetWriteAt) {
    const visibleRange = lastVerifiedSheetWrite.range.split("!").pop();
    const rangeText = `${lastVerifiedSheetWrite.sheetName}!${visibleRange}`;
    const verifiedTime = new Date(lastVerifiedSheetWriteAt).toLocaleString(config.language === "en" ? "en-US" : "vi-VN");
    el.sheetActionStatus.innerHTML = `
      <div class="sheet-confirm-card">
        <div>
          <strong>${escapeHtml(t("sheetVerifiedTitle"))}</strong>
          <p>${escapeHtml(t("sheetVerifiedHelp"))}</p>
        </div>
        <div class="sheet-confirm-grid">
          <span><small>${escapeHtml(t("sheetVerifiedRange"))}</small><b>${escapeHtml(rangeText)}</b></span>
          <span><small>${escapeHtml(t("sheetVerifiedTime"))}</small><b>${escapeHtml(verifiedTime)}</b></span>
        </div>
        <button type="button" data-sheet-action="open-verified">${escapeHtml(t("sheetVerifiedOpen"))}</button>
      </div>
    `;
    return;
  }
  el.sheetActionStatus.textContent = message;
}

function renderSheetTarget(summary = "") {
  if (!el.sheetTargetSummary) return;
  if (summary) {
    el.sheetTargetSummary.textContent = summary;
    renderSetupChecklist();
    renderSheetHealth();
    return;
  }
  const hasSheet = Boolean(spreadsheetIdFromUrl(el.sheetUrl.value));
  let startCell = String(el.sheetStartCell.value || defaultConfig.sheetStartCell).toUpperCase();
  try {
    const parsedCell = parseA1Cell(el.sheetStartCell.value);
    startCell = `${parsedCell.col}${parsedCell.row}`;
  } catch (error) { /* Keep the summary stable while the user edits the cell. */ }
  el.sheetTargetSummary.textContent = hasSheet
    ? tf("sheetTargetConnected", { sheetName: safeSheetName(el.sheetName.value), startCell })
    : t("sheetTargetAutoCreate");
  el.sheetTargetSummary.closest(".sheet-destination")?.setAttribute("data-state", hasSheet ? "connected" : "auto");
  renderSetupChecklist();
  renderSheetHealth();
}

function renderSheetHealth() {
  if (!el.sheetHealthCard) return;
  const spreadsheetId = spreadsheetIdFromUrl(el.sheetUrl.value);
  const sheetName = safeSheetName(el.sheetName.value || defaultConfig.sheetName);
  const startCell = String(el.sheetStartCell.value || defaultConfig.sheetStartCell).toUpperCase();
  const account = connectedGmail || t("gmailAccountDisconnected");
  const ready = Boolean(spreadsheetId);
  el.sheetHealthCard.dataset.state = ready ? "ready" : "missing";
  el.sheetHealthCard.innerHTML = `
    <div>
      <strong>${escapeHtml(t("sheetHealthTitle"))}</strong>
      <small>${escapeHtml(ready ? t("sheetHealthReady") : t("sheetHealthMissing"))}</small>
    </div>
    <div class="sheet-health-facts">
      <span>${escapeHtml(sheetName)}</span>
      <span>${escapeHtml(t("sheetHealthNextCell"))}: ${escapeHtml(startCell)}</span>
      <span>${escapeHtml(t("sheetHealthAccount"))}: ${escapeHtml(account)}</span>
    </div>
    <div class="sheet-health-actions">
      <button type="button" data-sheet-health-action="check">${escapeHtml(t("testSheet"))}</button>
      <button type="button" data-sheet-health-action="fix">${escapeHtml(t("quickFixCreateSheet"))}</button>
    </div>
  `;
}

function openSheetSettings(message) {
  const text = message || (config.language === "en"
    ? "Paste the Google Sheet link and confirm the tab name."
    : "Hãy dán link Google Sheet và kiểm tra tên tab.");
  toggleSettingsPanel(true);
  const group = el.sheetUrl.closest("details");
  if (group) group.open = true;
  setSheetFeedback(text, "warning");
  setGoogleStatus(text, "error");
  setStatus(text, "warning");
  requestAnimationFrame(() => {
    el.sheetUrl.scrollIntoView({ block: "center", behavior: "smooth" });
    el.sheetUrl.focus();
  });
}

function openExternalTab(url) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
      try {
        chrome.tabs.create({ url }, (tab) => {
          const error = chrome.runtime && chrome.runtime.lastError;
          if (error) reject(new Error(error.message || String(error)));
          else resolve(tab);
        });
      } catch (error) {
        reject(error);
      }
      return;
    }
    const opened = window.open(url, "_blank", "noopener");
    if (opened) resolve(opened);
    else reject(new Error(config.language === "en" ? "Chrome blocked the new tab." : "Chrome đã chặn tab mới."));
  });
}

function parseA1Cell(cell) {
  const match = String(cell || defaultConfig.sheetStartCell).trim().toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(t("invalidStartCell"));
  return { col: match[1], row: Number(match[2]), colNumber: columnNameToNumber(match[1]) };
}

function columnNameToNumber(name) {
  let result = 0;
  for (const char of name) result = result * 26 + char.charCodeAt(0) - 64;
  return result;
}

function columnNumberToName(num) {
  let name = "";
  let n = num;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function sheetNameA1(name) {
  return `'${String(name || "Sheet1").replace(/'/g, "''")}'`;
}

function safeSheetName(name) {
  const cleaned = String(name || "Payments").replace(/[\\/\?\*\[\]:]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "Payments").slice(0, 90);
}

function responseLooksLikeHtml(text) {
  return /^\s*</.test(String(text || ""));
}

function responseLooksLikeJson(text, contentType) {
  return String(contentType || "").toLowerCase().includes("json") || /^\s*[\[{]/.test(String(text || ""));
}

function googleReconnectError(message) {
  const err = new Error(message || t("googleUnexpectedResponse"));
  err.googleReconnect = true;
  return err;
}

function sheetAccessError(message) {
  const err = new Error(message || sheetAccessErrorMessage());
  err.sheetAccessFailed = true;
  return err;
}

function shouldReconnectGoogle(err) {
  return Boolean(err && err.googleReconnect);
}

async function runWithGoogleToken(operation, requestedScopes = [GOOGLE_SHEETS_SCOPE]) {
  let token = await getGoogleToken(true, requestedScopes);
  try {
    return await operation(token);
  } catch (err) {
    if (!shouldReconnectGoogle(err)) throw err;
    const retryMessage = t("googleReconnecting");
    setGoogleStatus(retryMessage, "ready");
    setStatus(retryMessage, "ready");
    await clearGoogleAuthCache();
    token = await getGoogleToken(true, requestedScopes);
    try {
      return await operation(token);
    } catch (retryErr) {
      throw retryErr;
    }
  }
}

async function sheetsApi(token, path, options = {}) {
  const baseUrl = "https://sheets.googleapis.com/v4/spreadsheets";
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const url = normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
  const res = await fetchWithTimeout(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  const contentType = res.headers && res.headers.get ? res.headers.get("content-type") || "" : "";
  let data = {};
  if (text && responseLooksLikeJson(text, contentType)) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      throw googleReconnectError(t("googleUnexpectedResponse"));
    }
  } else if (text && responseLooksLikeHtml(text)) {
    if (res.status === 401) await removeCachedGoogleToken(token);
    throw googleReconnectError(t("googleUnexpectedResponse"));
  } else if (text && res.ok) {
    throw googleReconnectError(t("googleUnexpectedResponse"));
  }
  if (!res.ok) {
    const message = data.error && data.error.message ? data.error.message : text || res.statusText;
    const errorDetails = JSON.stringify(data || {});
    if (res.status === 401) await removeCachedGoogleToken(token);
    if (res.status === 401) {
      throw googleReconnectError(t("googleTokenExpired"));
    }
    if (res.status === 403) {
      if (/quota|rate limit|exceeded/i.test(message)) throw new Error(message);
      if (/SERVICE_DISABLED|accessNotConfigured|has not been used|is disabled/i.test(`${message} ${errorDetails}`)) {
        const disabled = new Error(t("googleSheetsApiDisabled"));
        disabled.googleApiDisabled = true;
        throw disabled;
      }
      if (/ACCESS_TOKEN_SCOPE_INSUFFICIENT|insufficient authentication scopes|insufficient.*scope/i.test(`${message} ${errorDetails}`)) {
        const scopeError = new Error(t("googleSheetsScopeMissing"));
        scopeError.googleScopeMissing = true;
        throw scopeError;
      }
      throw sheetAccessError(message);
    }
    if (res.status === 404) {
      throw sheetAccessError();
    }
    throw new Error(message);
  }
  return data;
}

async function getSheetTitles(token, spreadsheetId) {
  const data = await sheetsApi(token, `${spreadsheetId}?fields=sheets.properties(title)`);
  return (data.sheets || []).map((sheet) => sheet.properties && sheet.properties.title).filter(Boolean);
}

async function getSheetProperties(token, spreadsheetId) {
  const data = await sheetsApi(token, `${spreadsheetId}?fields=sheets.properties(sheetId,title)`);
  return (data.sheets || []).map((sheet) => sheet.properties).filter(Boolean);
}

function normalizedSheetMatrix(values) {
  return (values || []).map((row) => (row || []).map((value) => String(value ?? "").trim()));
}

function sheetMatricesEqual(left, right) {
  return JSON.stringify(normalizedSheetMatrix(left)) === JSON.stringify(normalizedSheetMatrix(right));
}

async function verifySheetWrite(token, spreadsheetId, range, updateResponse) {
  const expected = updateResponse && updateResponse.updatedData && updateResponse.updatedData.values;
  if (!updateResponse || !updateResponse.updatedRange || Number(updateResponse.updatedCells || 0) < 1 || !expected || !expected.length) {
    throw new Error(config.language === "en"
      ? "Google did not confirm any updated cells. Nothing was marked as saved."
      : "Google không xác nhận ô nào đã được cập nhật. Dữ liệu chưa được đánh dấu là đã lưu.");
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const confirmed = await sheetsApi(token, `${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    if (sheetMatricesEqual(expected, confirmed.values)) return confirmed.values;
    await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
  }
  throw new Error(config.language === "en"
    ? "Google accepted the request, but the written cells could not be verified. Please try again."
    : "Google đã nhận yêu cầu nhưng RevenueFlow không đọc lại được dữ liệu vừa ghi. Vui lòng thử lại.");
}

async function focusSheetLink(token, spreadsheetId, sheetName, range) {
  const properties = await getSheetProperties(token, spreadsheetId);
  const target = properties.find((sheet) => sheet.title === sheetName);
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const url = target ? `${base}#gid=${target.sheetId}&range=${encodeURIComponent(range.split("!").pop())}` : base;
  el.sheetUrl.value = url;
  await saveConfig();
  return url;
}

async function ensureSheetTabExists(token, spreadsheetId, sheetName) {
  const titles = await getSheetTitles(token, spreadsheetId);
  if (!titles.includes(sheetName)) {
    await sheetsApi(token, `${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: sheetName } } }] })
    });
  }
}

async function ensureRevenueFlowHeader(token, spreadsheetId, sheetName) {
  const range = `${sheetNameA1(sheetName)}!A1:${columnNumberToName(REVENUEFLOW_SHEET_HEADERS.length)}1`;
  const existing = await sheetsApi(token, `${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
  const current = existing.values && existing.values[0] ? existing.values[0].map((value) => String(value || "").trim()) : [];
  if (current.join("|") === REVENUEFLOW_SHEET_HEADERS.join("|")) return;
  await sheetsApi(token, `${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values: [REVENUEFLOW_SHEET_HEADERS] })
  });
}

function isSheetAccessFailure(error) {
  if (!error) return false;
  if (error.sheetAccessFailed) return true;
  return /not visible|not found|no permission|access.*sheet|chưa truy cập|không tìm thấy|chưa có quyền/i.test(String(error.message || error));
}

async function createRevenueFlowSpreadsheet(preferredSheetName) {
  const sheetName = safeSheetName(preferredSheetName);
  const year = new Date().getFullYear();
  const data = await runWithGoogleToken(async (token) => {
    const created = await sheetsApi(token, "", {
      method: "POST",
      body: JSON.stringify({
        properties: { title: `RevenueFlow Payments ${year}` },
        sheets: [{ properties: { title: sheetName, gridProperties: { rowCount: 2000, columnCount: 26 } } }]
      })
    });
    if (created && created.spreadsheetId) await ensureRevenueFlowHeader(token, created.spreadsheetId, sheetName);
    return created;
  });
  if (!data || !data.spreadsheetId) throw new Error(config.language === "en" ? "Google did not return the new Sheet ID." : "Google không trả về mã Sheet mới.");
  const url = data.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`;
  el.sheetUrl.value = url;
  el.sheetName.value = sheetName;
  await saveConfig();
  return { spreadsheetId: data.spreadsheetId, sheetName, url };
}

async function prepareSheetWriteTarget(rowCount) {
  const start = parseA1Cell(el.sheetStartCell.value);
  const direction = el.sheetDirection.value === "up" ? "up" : "down";
  let spreadsheetId = spreadsheetIdFromUrl(el.sheetUrl.value);
  const suppliedSpreadsheetId = spreadsheetId;
  const requestedGid = sheetGidFromUrl(el.sheetUrl.value);
  let sheetName = safeSheetName(el.sheetName.value);
  let created = false;

  if (!spreadsheetId) {
    const next = await createRevenueFlowSpreadsheet(sheetName);
    spreadsheetId = next.spreadsheetId;
    sheetName = next.sheetName;
    created = true;
  }

  const locate = () => runWithGoogleToken(async (token) => {
    const properties = await getSheetProperties(token, spreadsheetId);
    if (suppliedSpreadsheetId) {
      // v3.1 UX fix: respect the Sheet tab typed by the user first.
      // Older builds used the first tab whenever the URL had no gid, so the app could say
      // "verified" while the user was looking at another tab.
      const typedName = safeSheetName(el.sheetName.value);
      const typedSheet = typedName ? properties.find((sheet) => sheet.title === typedName) : null;
      const gidSheet = requestedGid !== null ? properties.find((sheet) => Number(sheet.sheetId) === requestedGid) : null;
      const linkedSheet = typedSheet || gidSheet || properties[0];
      if (!linkedSheet) {
        throw new Error(config.language === "en" ? "The selected Google Sheet has no visible tabs." : "Google Sheet đã chọn không có tab nào truy cập được.");
      }
      sheetName = linkedSheet.title;
      el.sheetName.value = sheetName;
    } else {
      await ensureSheetTabExists(token, spreadsheetId, sheetName);
    }
    const row = await findTargetRow(token, spreadsheetId, sheetName, start, direction, rowCount);
    return { token, row };
  });

  try {
    return { ...(await locate()), spreadsheetId, sheetName, start, created };
  } catch (error) {
    if (!isSheetAccessFailure(error)) throw error;
    if (created) throw error;
    if (suppliedSpreadsheetId) {
      throw new Error(config.language === "en"
        ? "RevenueFlow cannot access the selected Sheet. No other Sheet was created or changed. Connect the Google account that owns this link."
        : "RevenueFlow không truy cập được Sheet đã chọn. Không có Sheet khác nào được tạo hoặc thay đổi. Hãy kết nối đúng tài khoản Google sở hữu link này.");
    }
    const next = await createRevenueFlowSpreadsheet(sheetName);
    spreadsheetId = next.spreadsheetId;
    sheetName = next.sheetName;
    created = true;
    return { ...(await locate()), spreadsheetId, sheetName, start, created };
  }
}

async function setupDefaultSheet() {
  setSheetActionBusy(true);
  setStatus(config.language === "en" ? "Creating your RevenueFlow Sheet..." : "Đang tạo Sheet RevenueFlow...", "ready");
  setSheetFeedback(config.language === "en" ? "Creating your RevenueFlow Sheet..." : "Đang tạo Sheet RevenueFlow...", "ready");
  try {
    const created = await createRevenueFlowSpreadsheet(el.sheetName.value || defaultConfig.sheetName);
    renderSheetTarget(`${created.sheetName} - A1`);
    await saveConfig();
    const message = t("defaultSheetCreated");
    setGoogleStatus(message, "success");
    setStatus(message, "success");
    setSheetFeedback(message, "success", { verifiedWrite: true });
    hideQuickFixActions();
    return created;
  } catch (err) {
    const message = config.language === "en" ? `Could not create Sheet: ${err.message}` : `Không tạo được Sheet: ${err.message}`;
    setGoogleStatus(message, "error");
    setStatus(message, "error");
    setSheetFeedback(message, "error");
    showQuickFixActions("sheet");
    return null;
  } finally {
    setSheetActionBusy(false);
  }
}

function canFitColumn(values, startIndex, rowCount) {
  for (let i = 0; i < rowCount; i += 1) {
    if (values[startIndex + i] && values[startIndex + i][0]) return false;
  }
  return true;
}

async function findTargetRow(token, spreadsheetId, sheetName, start, direction, rowCount) {
  const escapedSheet = sheetNameA1(sheetName);
  if (direction === "up") {
    const range = `${escapedSheet}!${start.col}1:${start.col}${start.row}`;
    const data = await sheetsApi(token, `${spreadsheetId}/values/${encodeURIComponent(range)}`);
    const values = data.values || [];
    for (let row = start.row - rowCount + 1; row >= 1; row -= 1) {
      if (canFitColumn(values, row - 1, rowCount)) return row;
    }
    return Math.max(1, start.row - rowCount + 1);
  }
  const endRow = start.row + 2000;
  const range = `${escapedSheet}!${start.col}${start.row}:${start.col}${endRow}`;
  const data = await sheetsApi(token, `${spreadsheetId}/values/${encodeURIComponent(range)}`);
  const values = data.values || [];
  for (let i = 0; i <= values.length; i += 1) {
    if (canFitColumn(values, i, rowCount)) return start.row + i;
  }
  return start.row + values.length;
}

async function writeRowsToSheet(rows) {
  lastVerifiedSheetWriteAt = "";
  lastVerifiedSheetWrite = null;
  const values = String(rows || "").split("\n").filter(Boolean).map(rowValues);
  if (!values.length) {
    setStatus(config.language === "en" ? "There are no rows to write." : "Chưa có dòng để ghi Sheet.", "warning");
    return false;
  }
  setSheetActionBusy(true);
  if (el.sheetsApiSetupLink) el.sheetsApiSetupLink.hidden = true;
  setGoogleStatus(t("googleWriting"), "ready");
  setStatus(t("googleWriting"), "ready");
  setSheetFeedback(t("googleWriting"), "ready");
  try {
    const writeTarget = await prepareSheetWriteTarget(values.length);
    const start = writeTarget.start;
    const targetRow = writeTarget.row;
    const endCol = columnNumberToName(start.colNumber + values[0].length - 1);
    const range = `${sheetNameA1(writeTarget.sheetName)}!${start.col}${targetRow}:${endCol}${targetRow + values.length - 1}`;
    try {
      const updateResponse = await sheetsApi(writeTarget.token, `${writeTarget.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED&includeValuesInResponse=true&responseValueRenderOption=FORMATTED_VALUE`, {
        method: "PUT",
        body: JSON.stringify({ range, majorDimension: "ROWS", values })
      });
      await verifySheetWrite(writeTarget.token, writeTarget.spreadsheetId, range, updateResponse);
      await focusSheetLink(writeTarget.token, writeTarget.spreadsheetId, writeTarget.sheetName, range);
      // Move the visible start cell according to the selected write direction.
      const nextStartRow = (el.sheetDirection.value === "up") ? Math.max(1, targetRow - 1) : targetRow + values.length;
      el.sheetStartCell.value = `${start.col}${nextStartRow}`;
      lastVerifiedSheetWriteAt = new Date().toISOString();
      lastVerifiedSheetWrite = {
        spreadsheetId: writeTarget.spreadsheetId,
        sheetName: writeTarget.sheetName,
        range,
        verifiedAt: lastVerifiedSheetWriteAt
      };
    } catch (err) {
      if (shouldReconnectGoogle(err)) throw new Error(t("googleWriteNotConfirmed"));
      throw err;
    }
    let message = writeTarget.created
      ? (config.language === "en" ? `Created your private RevenueFlow Sheet and wrote ${values.length} row(s).` : `Đã tự tạo Sheet RevenueFlow riêng và ghi ${values.length} dòng.`)
      : (config.language === "en" ? `Wrote ${values.length} row(s) at ${start.col}${targetRow}.` : `Đã ghi ${values.length} dòng tại ${start.col}${targetRow}.`);
    const visibleRange = range.split("!").pop();
    message = config.language === "en"
      ? `Verified in ${writeTarget.sheetName}!${visibleRange}. Open Sheet to view it.`
      : `Đã xác minh tại ${writeTarget.sheetName}!${visibleRange}. Bấm Mở Sheet để xem.`;
    renderSheetTarget(`${writeTarget.sheetName} - ${visibleRange}`);
    setGoogleStatus(message, "success");
    setStatus(message, "success");
    setSheetFeedback(message, "success");
    if (el.sheetsApiSetupLink) el.sheetsApiSetupLink.hidden = true;
    hideQuickFixActions();
    return true;
  } catch (err) {
    setGoogleStatus(err.message || t("googleConnectFailed"), "error");
    const message = config.language === "en" ? `Sheet write failed: ${err.message}` : `Ghi Sheet lỗi: ${err.message}`;
    setStatus(message, "error");
    setSheetFeedback(message, "error");
    if (el.sheetsApiSetupLink) el.sheetsApiSetupLink.hidden = !err.googleApiDisabled;
    showQuickFixActions("sheet");
    return false;
  } finally {
    setSheetActionBusy(false);
  }
}

async function testSheetConnection() {
  const spreadsheetId = spreadsheetIdFromUrl(el.sheetUrl.value);
  const sheetName = el.sheetName.value.trim();
  if (!spreadsheetId || !sheetName) {
    openSheetSettings(config.language === "en" ? "Google Sheet link or tab name is missing." : "Thiếu link Google Sheet hoặc tên tab. Dán link Sheet vào ô đang được chọn.");
    return false;
  }
  setSheetActionBusy(true);
  setGoogleStatus(t("googleTesting"), "ready");
  setStatus(t("googleTesting"), "ready");
  try {
    const start = parseA1Cell(el.sheetStartCell.value);
    const direction = el.sheetDirection.value === "up" ? "up" : "down";
    const targetRow = await runWithGoogleToken(async (token) => {
      await ensureSheetTabExists(token, spreadsheetId, sheetName);
      return findTargetRow(token, spreadsheetId, sheetName, start, direction, 1);
    });
    const message = config.language === "en"
      ? `Sheet OK. The next row can be written at ${start.col}${targetRow}.`
      : `Sheet dùng được. Dòng tiếp theo có thể ghi tại ${start.col}${targetRow}.`;
    setGoogleStatus(message, "success");
    setStatus(message, "success");
    setSheetFeedback(message, "success");
    hideQuickFixActions();
    return true;
  } catch (err) {
    const message = err.message || t("googleConnectFailed");
    setGoogleStatus(message, "error");
    setStatus(message, "error");
    setSheetFeedback(message, "error");
    showQuickFixActions("sheet");
    return false;
  } finally {
    setSheetActionBusy(false);
  }
}

function setBridgeActionBusy(isBusy) {
  [el.checkBridge, el.syncBridge, el.importBridgePayment, el.viewBridgeRecords, el.openBridgeSetup, el.quickCheckBridge, el.quickSyncBridge, el.quickImportBridgePayment, el.quickViewBridgeRecords, el.quickOpenBridgeSetup].forEach((button) => {
    if (button) button.disabled = isBusy;
  });
}

function setBridgeStatus(message, state = "idle") {
  el.bridgeStatus.textContent = message || t("bridgeStatusIdle");
  el.bridgeStatus.dataset.state = state;
}

function bridgeStateText(state) {
  if (state === "ready") return t("bridgeStatusReady");
  if (state === "review") return t("bridgeStatusReview");
  if (state === "blocked") return t("bridgeStatusBlocked");
  if (state === "syncing") return t("bridgeStatusSyncing");
  return t("bridgeStatusIdle");
}

function bridgeStateTone(state) {
  if (state === "ready") return "success";
  if (state === "review" || state === "syncing") return "warning";
  if (state === "blocked") return "error";
  return "idle";
}

function renderEmailBridgeStatus(data = {}) {
  const summary = data.summary || data;
  const records = data.records || [];
  const duplicates = data.duplicates || [];
  const needReview = summary.needReviewCount ?? data.needReview ?? records.filter((record) => record.needReview).length;
  const serviceState = data.serviceState || (needReview ? "review" : "");
  el.bridgeServiceState.textContent = serviceState ? bridgeStateText(serviceState) : "-";
  el.bridgeLastSync.textContent = data.lastSyncAt || data.generatedAt || "-";
  el.bridgeNextSync.textContent = data.nextSyncAt || "-";
  el.bridgeScanned.textContent = String(summary.scannedCount ?? data.scanned ?? 0);
  el.bridgeMatched.textContent = String(summary.matchedCount ?? data.matched ?? 0);
  el.bridgeNeedReview.textContent = String(needReview || 0);
  el.bridgeDuplicates.textContent = String(summary.skippedDuplicates ?? duplicates.length ?? 0);
  if (serviceState) setBridgeStatus(bridgeStateText(serviceState), bridgeStateTone(serviceState));
  workflowContext.emailBridge = data;
}

function localBridgeBaseUrl() {
  return String(config.bridgeUrl || defaultConfig.bridgeUrl || "").replace(/\/+$/, "");
}

function cloudSyncBaseUrl() {
  return String(config.cloudSyncUrl || defaultConfig.cloudSyncUrl || "").replace(/\/+$/, "");
}

function cloudSyncToken() {
  return String(config.cloudSyncToken || defaultConfig.cloudSyncToken || "").trim();
}

async function openLocalBridgeSetup() {
  await connectGmailAccount();
}

function isCloudSyncMode() {
  return false;
}

function isLocalEmailSyncMode() {
  return false;
}

function activeSourceName() {
  return "Gmail";
}

function localEmailSyncFriendlyError(rawError = "", code = "") {
  const value = String(rawError || "");
  const lower = value.toLowerCase();
  if (code === "IMAP_AUTH_FAILED" || /authenticationfailed|authentication failed|login/.test(lower)) {
    return config.language === "en"
      ? "RevenueFlow could not connect to Gmail. Reconnect Gmail, then try again."
      : "RevenueFlow chưa kết nối được Gmail. Kết nối lại Gmail rồi thử tiếp.";
  }
  if (code === "IMAP_CONNECTION_FAILED" || /timeout|eacces|econnrefused|enotfound|etimedout|network|certificate/.test(lower)) {
    return config.language === "en"
      ? "RevenueFlow cannot reach Gmail right now. Check internet access, reconnect Gmail, then try again."
      : "RevenueFlow chưa kết nối được Gmail lúc này. Kiểm tra mạng, kết nối lại Gmail rồi thử tiếp.";
  }
  if (code === "IMAP_CONFIG_MISSING" || /imap_user|imap_password/.test(lower)) {
    return config.language === "en"
      ? "Gmail is not connected yet. Click Connect Gmail, then try again."
      : "Gmail chưa được kết nối. Bấm Kết nối Gmail rồi thử lại.";
  }
  if (code === "PAYPAL_CONFIG_MISSING" || /paypal_client_id|paypal_client_secret/.test(lower)) {
    return config.language === "en"
      ? "This global build uses Gmail OAuth. Connect Gmail, then scan payment emails."
      : "Bản global dùng Gmail OAuth. Hãy kết nối Gmail rồi quét email payment.";
  }
  if (/failed to fetch|load failed|networkerror/.test(lower)) return t("bridgeCheckFailed");
  return value.replace(/LOGIN\s+"[^"]*"\s+"[^"]*"/i, 'LOGIN "<email>" "<hidden>"') || t("bridgeCheckFailed");
}

function cloudSyncFriendlyError(rawError = "", code = "") {
  const value = String(rawError || "");
  const lower = value.toLowerCase();
  if (code === "UNAUTHORIZED" || /unauthorized|invalid revenueflow api token|missing.*token/.test(lower)) {
    return config.language === "en"
      ? "Gmail authorization was rejected. Reconnect Gmail, then try again."
      : "Quyền Gmail bị từ chối. Kết nối lại Gmail rồi thử tiếp.";
  }
  if (/paypal api credentials|paypal client|client_id|client_secret/.test(lower)) {
    return config.language === "en"
      ? "This global build reads payment emails from Gmail, not PayPal API credentials."
      : "Bản global đọc email payment từ Gmail, không dùng PayPal API credentials.";
  }
  if (/failed to fetch|load failed|networkerror|unable to connect|connection refused/.test(lower)) {
    return config.language === "en"
      ? "Gmail is not reachable. Check internet access, reconnect Gmail, then try again."
      : "Chưa kết nối được Gmail. Kiểm tra mạng, kết nối lại Gmail rồi thử tiếp.";
  }
  return value || (config.language === "en" ? "Gmail request failed." : "Gmail chưa xử lý được yêu cầu.");
}

function canFallbackToLocalSync(error) {
  if (!isCloudSyncMode()) return false;
  const value = String(error && error.message ? error.message : error || "").toLowerCase();
  return /cloud sync is not reachable|chưa kết nối được cloud sync|failed to fetch|load failed|networkerror|unable to connect|connection refused/.test(value);
}

async function switchToLocalSyncFallback() {
  config.emailSourceMode = "gmail";
  config.bridgeUrl = "";
  config.cloudSyncUrl = "";
  config.cloudSyncToken = "";
  await saveConfig();
  setStatus(config.language === "en"
    ? "RevenueFlow will scan Gmail directly."
    : "RevenueFlow sẽ quét Gmail trực tiếp.",
    "warning");
}

async function localBridgeRequest(path, options = {}) {
  let res;
  try {
    res = await fetchWithTimeout(`${localBridgeBaseUrl()}${path}`, {
      method: options.method || "GET",
      headers: { "content-type": "application/json" },
      body: options.body ? JSON.stringify(options.body) : undefined
    }, 45000);
  } catch (error) {
    throw new Error(localEmailSyncFriendlyError(error && error.message ? error.message : error));
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(config.language === "en" ? "Gmail returned an invalid response." : "Gmail trả về phản hồi không hợp lệ.");
  }
  if (!res.ok || data.ok === false) throw new Error(localEmailSyncFriendlyError(data.error || res.statusText || t("bridgeCheckFailed"), data.errorCode));
  return data;
}

async function cloudSyncRequest(path, options = {}) {
  const token = cloudSyncToken();
  let res;
  try {
    res = await fetchWithTimeout(`${cloudSyncBaseUrl()}${path}`, {
      method: options.method || "GET",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {})
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    }, 45000);
  } catch (error) {
    throw new Error(cloudSyncFriendlyError(error && error.message ? error.message : error));
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(config.language === "en" ? "Gmail returned an invalid response." : "Gmail trả về phản hồi không hợp lệ.");
  }
  if (!res.ok || data.ok === false) throw new Error(cloudSyncFriendlyError(data.error || res.statusText || t("bridgeCheckFailed"), data.errorCode));
  return data;
}

function useLocalBridgeRecords(data = {}) {
  const annotated = annotateDuplicateRecords(data.records || []);
  bridgeQueueRecords = annotated;
  renderEmailBridgeStatus({ ...data, records: annotated });
  renderPaymentInbox(annotated);
  return annotated;
}

async function checkLocalEmailBridge() {
  const data = await localBridgeRequest("/health");
  renderEmailBridgeStatus({
    ok: true,
    serviceState: data.accountConfigured ? "ready" : "review",
    lastSyncAt: workflowContext.emailBridge && workflowContext.emailBridge.lastSyncAt ? workflowContext.emailBridge.lastSyncAt : "",
    summary: {
      scannedCount: bridgeQueueRecords.length,
      matchedCount: bridgeQueueRecords.length,
      parsedCount: bridgeQueueRecords.length,
      writableCount: bridgeQueueRecords.filter((record) => !record.needReview).length,
      skippedDuplicates: bridgeQueueRecords.filter((record) => record.isDuplicate).length,
      needReviewCount: bridgeQueueRecords.filter((record) => record.needReview).length
    },
    records: bridgeQueueRecords
  });
  setStatus(`${t("bridgeCheckSuccess")} ${data.email || ""}`.trim(), data.accountConfigured ? "success" : "warning");
  return data;
}

async function syncLocalEmailBridge() {
  const data = await localBridgeRequest("/sync", { method: "POST" });
  const recordsFromBridge = useLocalBridgeRecords(data);
  setStatus(recordsFromBridge.length ? t("bridgeSyncSuccess") : t("bridgeLatestEmpty"), recordsFromBridge.length ? "success" : "warning");
  return recordsFromBridge;
}

async function latestLocalEmailBridgeRecords() {
  const data = await localBridgeRequest("/latest");
  return useLocalBridgeRecords(data);
}

async function checkCloudSyncBridge() {
  const data = await cloudSyncRequest("/v1/sources");
  const source = data.sources || {};
  renderEmailBridgeStatus({
    ok: true,
    serviceState: "ready",
    lastSyncAt: workflowContext.emailBridge && workflowContext.emailBridge.lastSyncAt ? workflowContext.emailBridge.lastSyncAt : "",
    summary: {
      scannedCount: bridgeQueueRecords.length,
      matchedCount: bridgeQueueRecords.length,
      parsedCount: bridgeQueueRecords.length,
      writableCount: bridgeQueueRecords.filter((record) => !record.needReview).length,
      skippedDuplicates: bridgeQueueRecords.filter((record) => record.isDuplicate).length,
      needReviewCount: bridgeQueueRecords.filter((record) => record.needReview).length
    },
    records: bridgeQueueRecords
  });
  const paypalReady = source.paypalApi && source.paypalApi.available;
  setStatus(paypalReady
    ? (config.language === "en" ? "Gmail scan is ready." : "Quét Gmail đã sẵn sàng.")
    : (config.language === "en" ? "Gmail scan is ready. Connect Gmail if prompted." : "Quét Gmail đã sẵn sàng. Kết nối Gmail nếu được hỏi."),
    paypalReady ? "success" : "warning");
  return data;
}

async function syncCloudSyncBridge() {
  const data = await cloudSyncRequest("/v1/paypal/sync", { method: "POST" });
  const recordsFromBridge = useLocalBridgeRecords(data);
  setStatus(recordsFromBridge.length
    ? (config.language === "en" ? "Gmail scan imported payment records." : "Quét Gmail đã lấy payment.")
    : t("bridgeLatestEmpty"),
    recordsFromBridge.length ? "success" : "warning");
  return recordsFromBridge;
}

async function latestCloudSyncBridgeRecords() {
  const data = await cloudSyncRequest("/v1/records");
  return useLocalBridgeRecords(data);
}

async function checkEmailBridge() {
  setBridgeActionBusy(true);
  try {
    if (isCloudSyncMode()) {
      setStatus(config.language === "en" ? "Checking Gmail..." : "Đang kiểm tra Gmail...", "ready");
      try {
        return await checkCloudSyncBridge();
      } catch (error) {
        if (!canFallbackToLocalSync(error)) throw error;
        await switchToLocalSyncFallback();
        setStatus(config.language === "en" ? "Checking local Email Sync..." : "Đang kiểm tra Email Sync local...", "ready");
        return await checkLocalEmailBridge();
      }
    }
    if (isLocalEmailSyncMode()) {
      setStatus(config.language === "en" ? "Checking local Email Sync..." : "Đang kiểm tra Email Sync local...", "ready");
      return await checkLocalEmailBridge();
    }
    setStatus(config.language === "en" ? "Checking Gmail permission..." : "Đang kiểm tra quyền Gmail...", "ready");
    const token = await getGoogleToken(true, [GMAIL_READONLY_SCOPE]);
    const profile = await gmailApi(token, "profile");
    await acceptGmailProfile(profile);
    renderEmailBridgeStatus({
      ok: true,
      serviceState: "ready",
      lastSyncAt: workflowContext.emailBridge && workflowContext.emailBridge.lastSyncAt ? workflowContext.emailBridge.lastSyncAt : "",
      summary: {
        scannedCount: bridgeQueueRecords.length,
        matchedCount: bridgeQueueRecords.length,
        parsedCount: bridgeQueueRecords.length,
        writtenCount: 0,
        writableCount: bridgeQueueRecords.filter((record) => !record.needReview).length,
        skippedDuplicates: bridgeQueueRecords.filter((record) => record.isDuplicate).length,
        needReviewCount: bridgeQueueRecords.filter((record) => record.needReview).length
      },
      records: bridgeQueueRecords,
      duplicates: bridgeQueueRecords.filter((record) => record.isDuplicate)
    });
    setBridgeStatus(t("bridgeStatusReady"), "success");
    setOAuthUserLog(t("oauthLogConnected"), "success");
    setStatus(`${t("bridgeCheckSuccess")} ${profile.emailAddress || ""}`.trim(), "success");
    await saveConfig();
    return profile;
  } catch (err) {
    const friendly = isCloudSyncMode()
      ? cloudSyncFriendlyError(err && err.message ? err.message : err)
      : isLocalEmailSyncMode()
        ? localEmailSyncFriendlyError(err && err.message ? err.message : err)
        : userFriendlyOAuthError(err);
    setOAuthUserLog(friendly, "error");
    setBridgeStatus(t("bridgeStatusError"), "error");
    setStatus(friendly, "error");
    return null;
  } finally {
    setBridgeActionBusy(false);
  }
}

async function refreshEmailBridgeStatus({ silent = true } = {}) {
  renderGmailSyncStatus(bridgeQueueRecords);
  if (!silent) setStatus(t("bridgeCheckSuccess"), "success");
  return workflowContext.emailBridge;
}

async function syncEmailBridge() {
  setBridgeActionBusy(true);
  setBridgeStatus(t("bridgeStatusSyncing"), "warning");
  try {
    if (isCloudSyncMode()) {
      try {
        return await syncCloudSyncBridge();
      } catch (error) {
        if (!canFallbackToLocalSync(error)) throw error;
        await switchToLocalSyncFallback();
        return await syncLocalEmailBridge();
      }
    }
    if (isLocalEmailSyncMode()) {
      return await syncLocalEmailBridge();
    }
    const gmailRecords = await scanGmailPayments();
    renderGmailSyncStatus(gmailRecords);
    setBridgeStatus(t("bridgeStatusReady"), "success");
    setStatus(gmailRecords.length ? t("bridgeSyncSuccess") : gmailNoMatchMessage(), gmailRecords.length ? "success" : "warning");
    await saveConfig();
    return workflowContext.emailBridge;
  } catch (err) {
    const friendly = userFriendlyOAuthError(err);
    setOAuthUserLog(friendly, "error");
    setBridgeStatus(t("bridgeStatusError"), "error");
    setStatus(friendly, "error");
    return null;
  } finally {
    setBridgeActionBusy(false);
  }
}

async function startPaymentWorkflow() {
  setBridgeActionBusy(true);
  setBridgeStatus(t("bridgeStatusSyncing"), "warning");
  setStatus(config.language === "en" ? "Scanning Gmail and preparing the latest payment..." : "Đang quét Gmail và chuẩn bị payment mới nhất...",
    "ready");
  try {
    await ensureFreshRate({ force: true, silent: true });
    let recordsFromBridge;
    if (isCloudSyncMode()) {
      try {
        recordsFromBridge = await syncCloudSyncBridge();
      } catch (error) {
        if (!canFallbackToLocalSync(error)) throw error;
        await switchToLocalSyncFallback();
        recordsFromBridge = await syncLocalEmailBridge();
      }
    } else {
      recordsFromBridge = isLocalEmailSyncMode() ? await syncLocalEmailBridge() : await scanGmailPayments();
    }
    if (!isLocalEmailSyncMode() && !isCloudSyncMode()) renderGmailSyncStatus(recordsFromBridge);
    const selected = recordsFromBridge.find((record) => !record.needReview) || recordsFromBridge[0];
    if (!selected) {
      setBridgeStatus(t("bridgeStatusIdle"), "warning");
      setStatus(gmailNoMatchMessage(), "warning");
      return;
    }
    const paymentRecord = normalizeBridgeRecordToPaymentRecord(selected);
    workflowContext.paymentRecord = paymentRecord;
    records = [paymentRecord];
    activeIndex = 0;
    renderRecordSelector();
    renderForm(paymentRecord);
    setBridgeStatus(t("bridgeStatusImported"), selected.needReview ? "warning" : "success");
    hideQuickFixActions();
    setStatus(selected.needReview
      ? (config.language === "en" ? "Payment imported, but some fields need review before writing to Sheet." : "Đã lấy payment, nhưng cần kiểm tra thêm dữ liệu trước khi ghi Sheet.")
      : (config.language === "en" ? "Payment imported. Review the fields, then write to Sheet." : "Đã lấy payment. Kiểm tra thông tin rồi bấm Ghi vào Sheet."),
      selected.needReview ? "warning" : "success"
    );
    await saveConfig();
  } catch (err) {
    const friendly = isCloudSyncMode()
      ? cloudSyncFriendlyError(err && err.message ? err.message : err)
      : isLocalEmailSyncMode()
        ? localEmailSyncFriendlyError(err && err.message ? err.message : err)
        : userFriendlyOAuthError(err);
    setOAuthUserLog(friendly, "error");
    setBridgeStatus(t("bridgeStatusError"), "error");
    setStatus(friendly, "error");
    showQuickFixActions("gmail");
  } finally {
    setBridgeActionBusy(false);
  }
}

async function latestBridgeRecords() {
  if (isCloudSyncMode()) return latestCloudSyncBridgeRecords();
  if (isLocalEmailSyncMode()) return latestLocalEmailBridgeRecords();
  renderPaymentInbox(bridgeQueueRecords);
  return bridgeQueueRecords;
}

function normalizeBridgeRecordToPaymentRecord(record) {
  const type = record.emailType || record.paymentType || record.type || "unknown";
  const usd = record.amountUsd || record.usd || "";
  const sourceText = `${record.rawText || ""}\n${record.body || ""}\n${record.subject || ""}`;
  const product = resolveProductName({
    emailProduct: record.product || productFromEmailText(sourceText),
    amount: usd,
    text: sourceText
  }).value;
  return {
    source: record.source || (isCloudSyncMode() ? "cloudSync" : (isLocalEmailSyncMode() ? "localImap" : "directGmail")),
    date: record.date || "",
    type,
    customerName: record.customerName || "",
    customerEmail: record.customerEmail || "",
    orderNo: record.orderNo || "",
    usd,
    product,
    isDuplicate: Boolean(record.isDuplicate),
    duplicateApproved: Boolean(record.duplicateApproved),
    provider: record.provider || record.note || "Payment",
    emailType: type,
    status: record.status || "Info",
    revenueImpact: record.revenueImpact || "none",
    shouldWriteToRevenueSheet: record.shouldWriteToRevenueSheet === true,
    writableReason: record.writableReason || "",
    note: record.note || record.provider || "Payment",
    transactionId: record.transactionId || "",
    profileId: record.profileId || "",
    billingAgreementId: record.billingAgreementId || "",
    subscriptionId: record.subscriptionId || "",
    nextPaymentDate: record.nextPaymentDate || "",
    currency: record.currency || "USD",
    customFields: cleanCustomFields(record.customFields || record.extraFields || autoCustomFieldsFromText(`${record.rawText || ""}\n${record.body || ""}\n${record.subject || ""}`)),
    confidence: {
      type: confidence(type, activeSourceName()),
      customerName: confidence(record.customerName, activeSourceName()),
      customerEmail: confidence(record.customerEmail, activeSourceName()),
      orderNo: confidence(record.orderNo, record.needReview ? "Need Review" : activeSourceName()),
      usd: confidence(usd, activeSourceName()),
      product: confidence(product, record.needReview ? "Need Review" : activeSourceName())
    }
  };
}

async function importLatestBridgePayment() {
  setBridgeActionBusy(true);
  try {
    await ensureFreshRate({ force: true, silent: true });
    const recordsFromBridge = await latestBridgeRecords();
    const selected = recordsFromBridge.find((record) => !record.needReview) || recordsFromBridge[0];
    if (!selected) {
      setStatus(t("bridgeLatestEmpty"), "warning");
      return;
    }
    const paymentRecord = normalizeBridgeRecordToPaymentRecord(selected);
    workflowContext.paymentRecord = paymentRecord;
    records = [paymentRecord];
    activeIndex = 0;
    renderRecordSelector();
    renderForm(paymentRecord);
    setBridgeStatus(t("bridgeStatusImported"), selected.needReview ? "warning" : "success");
    setStatus(t("bridgeImportSuccess"), selected.needReview ? "warning" : "success");
  } catch (err) {
    const friendly = isLocalEmailSyncMode() ? localEmailSyncFriendlyError(err && err.message ? err.message : err) : (err.message || t("bridgeCheckFailed"));
    setBridgeStatus(t("bridgeStatusError"), "error");
    setStatus(friendly, "error");
  } finally {
    setBridgeActionBusy(false);
  }
}

async function viewLatestBridgeRecords() {
  setBridgeActionBusy(true);
  try {
    const recordsFromBridge = await latestBridgeRecords();
    el.bridgeRecordsPreview.hidden = false;
    el.bridgeRecordsPreview.value = JSON.stringify(recordsFromBridge, null, 2);
    setBridgeStatus(recordsFromBridge.length ? t("bridgeStatusReady") : t("bridgeStatusIdle"), recordsFromBridge.length ? "success" : "warning");
  } catch (err) {
    const friendly = isLocalEmailSyncMode() ? localEmailSyncFriendlyError(err && err.message ? err.message : err) : (err.message || t("bridgeCheckFailed"));
    setBridgeStatus(t("bridgeStatusError"), "error");
    setStatus(friendly, "error");
  } finally {
    setBridgeActionBusy(false);
  }
}

function exportCsv() {
  const exportRecords = uniqueRevenueRecords();
  if (!exportRecords.length) {
    setStatus(config.language === "en" ? "There is no history to export." : "Chưa có lịch sử để xuất CSV.", "warning");
    return;
  }
  const header = ["date", "provider", "customerName", "customerEmail", "orderNo", "usd", "product", "type", "transactionId", "profileId", "writtenToSheet", "possibleDuplicate"];
  const csv = [header.join(",")]
    .concat(exportRecords.map((item) => header.map((key) => csvEscape(key === "possibleDuplicate" ? Boolean(item.isDuplicate) : item[key])).join(",")))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `revenueflow-payments-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  setStatus(config.language === "en" ? "History CSV exported." : "Đã xuất CSV lịch sử.", "success");
}

async function copyAccountingRow() {
  const record = formData();
  const copied = await safeCopy(accountingRow(record));
  if (!copied) return;
  updateAccountingPreview(record);
  setStatus(t("accountingCopied"), "success");
}

async function copyInvoiceDraft() {
  const record = formData();
  const copied = await safeCopy(invoiceDraftText(record));
  if (!copied) return;
  updateAccountingPreview(record);
  setStatus(t("invoiceDraftCopied"), "success");
}

function bulkReadyRows() {
  return readyBulkRecords().map((record) => makeRow(normalizeBridgeRecordToPaymentRecord(record))).join("\n");
}

async function copyReadyPayments() {
  await ensureFreshRate({ force: true, silent: true });
  const rows = bulkReadyRows();
  if (!rows) {
    setStatus(t("bulkNoneReady"), "warning");
    return;
  }
  const copied = await safeCopy(rows);
  if (!copied) return;
  setStatus(t("bulkCopiedReady"), "success");
}

async function saveReadyPaymentsToSheet() {
  const ready = readyBulkRecords();
  if (!ready.length) {
    setStatus(t("bulkNoneReady"), "warning");
    return;
  }
  await ensureFreshRate({ force: true, silent: true });
  const beforeStats = paymentQueueStats();
  const normalized = ready.map((record) => normalizeBridgeRecordToPaymentRecord(record));
  const rows = normalized.map((record) => makeRow(record)).join("\n");
  const wrote = await writeRowsToSheet(rows);
  if (!wrote) return;
  const rangeText = lastVerifiedSheetWrite ? `${lastVerifiedSheetWrite.sheetName}!${lastVerifiedSheetWrite.range.split("!").pop()}` : "";
  const now = lastVerifiedSheetWriteAt || new Date().toISOString();
  ready.forEach((record) => {
    record.writtenToSheet = true;
    record.sheetWrittenAt = now;
    record.sheetRange = rangeText;
  });
  normalized.forEach((record, index) => addHistory({ ...record, writtenToSheet: true, sheetWrittenAt: now, sheetRange: rangeText }, rows.split("\n")[index], { writtenToSheet: true }));
  renderPaymentInbox(bridgeQueueRecords);
  renderRecordSelector();
  renderSetupChecklist();
  const skipped = Math.max(0, beforeStats.total - ready.length);
  setStatus(t("bulkSavedReadyDetailed")
    .replace("{saved}", String(ready.length))
    .replace("{skipped}", String(skipped)), "success");
}

function accountingColumnGuide(preset = activeAccountingPreset()) {
  const descriptions = {
    invoice_date: "Invoice/payment date",
    invoice_no: "Optional invoice number from your accounting app",
    customer_name: "Customer or buyer name",
    customer_email: "Customer email",
    item_name: "Product or service name",
    description: "Payment notes and extra email details",
    quantity: "Default 1",
    unit_price: "Unit amount in the payment currency",
    currency: "Currency, usually USD",
    subtotal: "Amount before tax",
    tax_rate: "Tax/VAT rate configured in RevenueFlow",
    total: "Total amount",
    payment_provider: "PayPal, Stripe, bank transfer, or custom provider",
    payment_reference: "Transaction ID",
    order_reference: "Order, recurring, subscription, or profile reference",
    status: "draft, reviewed, or needs_review",
    notes: "Extra payment fields"
  };
  return accountingExportHeaders(preset)
    .map((header) => `${header}: ${descriptions[header] || "Imported accounting field"}`)
    .join("\n");
}

function sampleAccountingRecord() {
  return {
    date: new Date().toISOString().slice(0, 10),
    invoiceDate: new Date().toISOString().slice(0, 10),
    invoiceNo: "DRAFT-001",
    customerName: "Sample Customer",
    customerEmail: "customer@example.com",
    product: "Sample product or service",
    usd: "99.00",
    currency: "USD",
    provider: "PayPal",
    note: "PayPal",
    transactionId: "SAMPLE-TXN-001",
    orderNo: "ORDER-001",
    status: "draft",
    customFields: [{ name: "Source", value: "RevenueFlow sample" }]
  };
}

async function copyAccountingGuide() {
  const copied = await safeCopy(accountingColumnGuide(activeAccountingPreset()));
  if (!copied) return;
  setStatus(t("accountingGuideCopied"), "success");
}

function exportAccountingSample() {
  const preset = activeAccountingPreset();
  const header = accountingExportHeaders(preset);
  const csv = [header.join(","), accountingExportValues(sampleAccountingRecord(), preset, { ignoreForm: true }).map(csvEscape).join(",")].join("\n");
  const slug = preset === "misa_basic" ? "misa-sample" : preset === "invoice_standard" ? "invoice-sample" : "accounting-sample";
  downloadTextFile(`revenueflow-${slug}.csv`, csv, "text/csv;charset=utf-8");
  setStatus(t("accountingSampleExported"), "success");
}

async function saveAccountingTemplate() {
  if (!el.accountingTemplateText || !String(el.accountingTemplateText.value || "").trim()) {
    setStatus(t("accountingTemplateMissing"), "warning");
    return;
  }
  if (el.accountingPreset) el.accountingPreset.value = "custom_template";
  updateAccountingPreview(formData());
  await saveConfig();
  setStatus(t("accountingTemplateSaved"), "success");
}

async function clearAccountingTemplate() {
  if (el.accountingTemplateText) el.accountingTemplateText.value = "";
  if (el.accountingPreset) el.accountingPreset.value = "invoice_standard";
  updateAccountingPreview(formData());
  await saveConfig();
  setStatus(t("accountingTemplateCleared"), "success");
}

function exportAccountingCsv(preset = activeAccountingPreset()) {
  const exportRecords = uniqueRevenueRecords();
  const source = exportRecords.length ? exportRecords : records.filter(Boolean);
  if (!source.length) {
    setStatus(config.language === "en" ? "There are no payments to export." : "Chưa có payment để xuất.", "warning");
    return;
  }
  const header = accountingExportHeaders(preset);
  const csv = [header.join(",")]
    .concat(source.map((item) => accountingExportValues(item, preset).map(csvEscape).join(",")))
    .join("\n");
  const slug = preset === "misa_basic" ? "misa" : preset === "invoice_standard" ? "invoice" : "accounting";
  downloadTextFile(`revenueflow-${slug}-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv;charset=utf-8");
  const now = new Date().toISOString();
  source.forEach((record) => {
    record.accountingExportedAt = now;
  });
  if (records[activeIndex]) records[activeIndex] = { ...records[activeIndex], accountingExportedAt: records[activeIndex].accountingExportedAt || now };
  renderPaymentInbox();
  updateAccountingPreview(formData());
  setStatus(preset === "misa_basic" || preset === "invoice_standard" ? t("misaCsvExported") : t("accountingCsvExported"), "success");
}

function exportMisaCsv() {
  exportAccountingCsv(activeAccountingPreset());
}

function renderHistory() {
  if (!historyItems.length) {
    el.historyList.textContent = t("noHistory");
    return;
  }
  el.historyList.innerHTML = historyItems.slice(0, 8).map((item, index) => `
    <div class="history-item">
      <div class="history-main">
        <strong>${escapeHtml(item.customerName || item.orderNo || (config.language === "en" ? "PayPal transaction" : "Giao dịch PayPal"))}</strong>
        <small>${escapeHtml(item.usd || "-")} USD · ${escapeHtml(item.product || (config.language === "en" ? "no product" : "chưa có sản phẩm"))}</small>
      </div>
      <button class="ghost history-copy" data-index="${index}" type="button">${escapeHtml(t("copy"))}</button>
    </div>
  `).join("");
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function downloadTextFile(filename, content, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}

async function exportSettingsBackup() {
  await saveConfig();
  const payload = {
    app: "RevenueFlow Assistant",
    version: defaultConfig.configVersion,
    exportedAt: new Date().toISOString(),
    config,
    historyItems
  };
  downloadTextFile(`revenueflow-settings-v${defaultConfig.configVersion}.json`, JSON.stringify(payload, null, 2));
  setStatus(t("settingsExported"), "success");
}

function importSettingsBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      if (!payload || !payload.config) throw new Error("Invalid RevenueFlow settings file.");
      historyItems = Array.isArray(payload.historyItems) ? payload.historyItems : historyItems;
      applyConfig({ ...defaultConfig, ...payload.config, configVersion: defaultConfig.configVersion });
      await storageSet({ config, historyItems });
      renderHistory();
      renderPaymentInbox();
      setStatus(t("settingsImported"), "success");
    } catch (error) {
      setStatus(config.language === "en" ? `Import failed: ${error.message}` : `Nhập cấu hình lỗi: ${error.message}`, "error");
    }
  };
  reader.readAsText(file);
}

async function applyRecommendedPresets() {
  if (!globalThis.RevenueFlowRules) return;
  gatewayRules = RevenueFlowRules.getDefaultGatewayRules().map((rule) => ({ ...rule, enabled: rule.id !== "custom" }));
  el.gatewayRulesJson.value = JSON.stringify(gatewayRules, null, 2);
  await persistGatewayRules();
  setStatus(t("presetsApplied"), "success");
}

function loadDemoPaymentRecord() {
  const demo = {
    source: "demo",
    provider: "PayPal",
    emailType: "successful_payment",
    type: "successful_payment",
    status: "Paid",
    revenueImpact: "positive",
    shouldWriteToRevenueSheet: true,
    date: todayVN(),
    customerName: "Acme Demo Co.",
    customerEmail: "demo@example.com",
    orderNo: "DEMO-TXN-1001",
    usd: "49.00",
    amountUsd: "49.00",
    product: guessProduct("49.00") || "",
    transactionId: "DEMO-TXN-1001",
    profileId: "DEMO-PROFILE-01",
    rawSubject: "You received a payment",
    rawFrom: "service@paypal.com",
    confidence: {
      type: confidence("successful_payment", "Demo"),
      customerName: confidence("Acme Demo Co.", "Demo"),
      customerEmail: confidence("demo@example.com", "Demo"),
      orderNo: confidence("DEMO-TXN-1001", "Demo"),
      usd: confidence("49.00", "Demo"),
      product: confidence("", "Demo")
    }
  };
  bridgeQueueRecords = annotateDuplicateRecords([demo, ...bridgeQueueRecords]);
  records = [normalizeBridgeRecordToPaymentRecord(demo)];
  activeIndex = 0;
  renderRecordSelector();
  renderPaymentInbox(bridgeQueueRecords);
  renderPaymentDetail(demo);
  renderForm(records[activeIndex]);
  setStatus(t("demoPaymentLoaded"), "success");
}

function renderGatewaySettings() {
  if (!el.gatewayRulesList || !globalThis.RevenueFlowRules) return;
  const mode = config.ruleMode === "custom" ? "custom" : "default";
  const providerBlock = document.getElementById("providerRulesBlock");
  if (providerBlock) providerBlock.dataset.ruleMode = mode;
  const parsed = RevenueFlowRules.parseGatewayRules(gatewayRules, RevenueFlowRules.getDefaultGatewayRules());
  gatewayRules = parsed.rules;
  el.gatewayRulesList.innerHTML = gatewayRules.map((rule, index) => `
    <label class="gateway-rule-item">
      <input type="checkbox" data-gateway-index="${index}" ${rule.enabled ? "checked" : ""}>
      <span><strong>${escapeHtml(rule.name)}</strong><small>${escapeHtml((rule.senderDomains || []).join(", ") || "Keyword based")}</small></span>
    </label>`).join("");
  el.gatewayRulesJson.value = JSON.stringify(gatewayRules, null, 2);
  const typeLabels = {
    successful_payment: t("eventSuccessfulPayment"),
    recurring_payment_success: t("eventRecurringPaymentSuccess"),
    invoice_paid: t("eventInvoicePaid"),
    refund: t("eventRefund"),
    payment_failed: t("eventPaymentFailed"),
    recurring_payment_failed: t("eventPaymentFailed"),
    dispute: t("eventDispute"),
    chargeback: t("eventDispute")
  };
  const types = Object.keys(RevenueFlowRules.TYPE_META);
  const select = document.getElementById("customEmailType");
  if (select) {
    const selected = select.value || "successful_payment";
    select.innerHTML = types.map((type) => `<option value="${type}">${escapeHtml(typeLabels[type] || displayEmailType(type))}</option>`).join("");
    select.value = types.includes(selected) ? selected : "successful_payment";
  }
  el.gatewayRuleWarnings.hidden = !parsed.warnings.length;
  el.gatewayRuleWarnings.textContent = parsed.warnings.join("\n");
}

function csvList(id) {
  const node = document.getElementById(id);
  return String(node && node.value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function customRuleFromForm() {
  const name = document.getElementById("customGatewayName").value.trim() || "Custom";
  const emailType = document.getElementById("customEmailType").value || "unknown";
  const fieldMap = {
    amount: "customAmountRegex", customerName: "customCustomerNameRegex", customerEmail: "customCustomerEmailRegex",
    orderNo: "customOrderRegex", transactionId: "customTransactionRegex", profileId: "customSubscriptionRegex",
    date: "customDateRegex", nextPaymentDate: "customNextPaymentDateRegex"
  };
  const extractionRules = {};
  Object.entries(fieldMap).forEach(([key, id]) => {
    const value = document.getElementById(id).value.trim();
    if (value) extractionRules[key] = value;
  });
  return {
    id: `custom_${Date.now()}`,
    name,
    enabled: true,
    senderDomains: csvList("customSenderDomains"),
    searchKeywords: csvList("customSearchKeywords"),
    ignoreKeywords: csvList("customIgnoreKeywords"),
    emailTypeRules: [{
      emailType,
      keywords: csvList("customEmailTypeKeywords"),
      shouldWriteToRevenueSheet: document.getElementById("customShouldWrite").checked,
      revenueImpact: document.getElementById("customRevenueImpact").value
    }],
    extractionRules,
    defaultSheetBehavior: document.getElementById("customShouldWrite").checked ? "revenue_only" : "never"
  };
}

async function persistGatewayRules() {
  const parsed = RevenueFlowRules.parseGatewayRules(el.gatewayRulesJson.value, gatewayRules);
  if (parsed.warnings.length) {
    el.gatewayRuleWarnings.hidden = false;
    el.gatewayRuleWarnings.textContent = parsed.warnings.join("\n");
    return false;
  }
  gatewayRules = parsed.rules;
  config.gatewayRules = gatewayRules;
  await saveConfig();
  renderGatewaySettings();
  setStatus(config.language === "en" ? "Payment gateway rules saved." : "Đã lưu rule cổng thanh toán.", "success");
  return true;
}

async function saveConfig() {
  config = {
    configVersion: defaultConfig.configVersion,
    rate: moneyNumber(el.rate.value) || defaultConfig.rate,
    rateInfo: lastRateInfo ? { ...lastRateInfo, value: moneyNumber(el.rate.value) || lastRateInfo.value || defaultConfig.rate } : (config.rateInfo || null),
    product: el.product.value,
    rulesText: el.rulesText.value,
    productAliases: currentProductAliases(),
    sourceRulesText: el.sourceRulesText.value,
    ruleMode: el.ruleMode ? el.ruleMode.value : defaultConfig.ruleMode,
    gatewayRules: currentGatewayRules(),
    invoiceNo: el.invoiceNo.value,
    invoiceDate: el.invoiceDate.value,
    sheetUrl: el.sheetUrl.value,
    targetGmailAccount: el.targetGmailAccount.value.trim(),
    sheetName: el.sheetName.value,
    sheetStartCell: el.sheetStartCell.value,
    sheetDirection: el.sheetDirection.value,
    sheetFieldColumns: collectSheetFieldColumns(),
    writeCustomFields: el.writeCustomFields ? el.writeCustomFields.checked : defaultConfig.writeCustomFields,
    customFieldsSheetColumn: el.customFieldsSheetColumn ? sanitizeSheetColumn(el.customFieldsSheetColumn.value, defaultConfig.customFieldsSheetColumn) : defaultConfig.customFieldsSheetColumn,
    vatPercent: moneyNumber(el.vatPercent.value),
    paypalFeePercent: moneyNumber(el.paypalFeePercent.value),
    autoCopy: el.autoCopy.checked,
    strictValidation: el.strictValidation.checked,
    appendAccounting: el.appendAccounting.checked,
    accountingPreset: activeAccountingPreset(),
    accountingTemplateText: el.accountingTemplateText ? el.accountingTemplateText.value : config.accountingTemplateText,
    accountingConnector: activeAccountingConnector(),
    accountingConnectorUrl: el.accountingConnectorUrl ? el.accountingConnectorUrl.value.trim() : "",
    accountingConnectorNotes: el.accountingConnectorNotes ? el.accountingConnectorNotes.value.trim() : "",
    autoIncrementInvoice: el.autoIncrementInvoice.checked,
    autoWriteSheet: el.autoWriteSheet.checked,
    enableEmailBridge: false,
    bridgeUrl: "",
    cloudSyncUrl: "",
    cloudSyncToken: "",
    emailSourceMode: "gmail",
    fontFamily: el.fontFamily.value || defaultConfig.fontFamily,
    fontSize: Math.max(12, Math.min(18, Number(el.fontSize.value || defaultConfig.fontSize))),
    primaryColor: el.primaryColor.value || defaultConfig.primaryColor,
    panelColor: el.panelColor.value || defaultConfig.panelColor,
    theme: document.body.classList.contains("dark") ? "dark" : "light",
    language: config.language || "vi",
    dismissedTips: config.dismissedTips || {}
  };
  await storageSet({ config });
}

function scheduleSaveConfig() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveConfig();
  }, 250);
}

function applyConfig(nextConfig) {
  const incoming = nextConfig || {};
  config = { ...defaultConfig, ...incoming, dismissedTips: { ...(defaultConfig.dismissedTips || {}), ...(incoming.dismissedTips || {}) } };
  gatewayRules = globalThis.RevenueFlowRules
    ? (Array.isArray(incoming.gatewayRules) && incoming.gatewayRules.length
      ? RevenueFlowRules.parseGatewayRules(incoming.gatewayRules).rules
      : migrateLegacyGatewayRules(incoming.sourceRulesText || defaultConfig.sourceRulesText))
    : [];
  config.gatewayRules = gatewayRules;
  if (!incoming.configVersion && String(incoming.targetGmailAccount || "").toLowerCase() === "admin@netbasejsc.com") {
    config.targetGmailAccount = "";
  }
  config.bridgeUrl = "";
  config.cloudSyncUrl = "";
  config.cloudSyncToken = "";
  config.emailSourceMode = "gmail";
  config.enableEmailBridge = false;
  config.rulesText = sanitizeProductRulesText(config.rulesText);
  config.productAliases = normalizeProductAliases(config.productAliases || []);
  config.sheetFieldColumns = normalizeSheetFieldColumns(config.sheetFieldColumns || defaultConfig.sheetFieldColumns);
  if (config.product && (REVIEW_PRODUCT_PATTERN.test(config.product) || INTERNAL_PRODUCT_PATTERN.test(config.product) || isLegacySampleProductName(config.product))) config.product = "";
  if (/^Recurring\s+\d{4}$/i.test(String(config.sheetName || ""))) config.sheetName = defaultConfig.sheetName;
  if (String(incoming.configVersion || "").localeCompare("6.2.0", undefined, { numeric: true }) < 0) {
    config.rulesText = sanitizeProductRulesText(config.rulesText);
    config.productAliases = normalizeProductAliases(config.productAliases).filter((alias) => !alias.keywords.some((keyword) => INTERNAL_PRODUCT_PATTERN.test(keyword)));
  }
  // v3.5: old builds pre-filled invoice values and confused users. Reset them once on upgrade.
  if (String(incoming.configVersion || "").localeCompare("3.5.0", undefined, { numeric: true }) < 0) {
    config.invoiceNo = "";
    config.invoiceDate = "";
  }
  el.rate.value = config.rate;
  lastRateInfo = config.rateInfo && Number(config.rateInfo.value)
    ? config.rateInfo
    : { value: config.rate, source: "Manual", refreshedAt: "" };
  lastRateRefreshAt = lastRateInfo.refreshedAt || lastRateInfo.updatedAt || "";
  el.invoiceNo.value = config.invoiceNo;
  el.invoiceDate.value = config.invoiceDate;
  el.sheetUrl.value = config.sheetUrl;
  el.targetGmailAccount.value = config.targetGmailAccount || "";
  el.sheetName.value = config.sheetName || defaultConfig.sheetName;
  el.sheetStartCell.value = config.sheetStartCell || defaultConfig.sheetStartCell;
  fillDirectionOptions();
  el.sheetDirection.value = config.sheetDirection === "up" ? "up" : "down";
  applySheetFieldColumnsToInputs(config.sheetFieldColumns);
  if (el.writeCustomFields) el.writeCustomFields.checked = config.writeCustomFields !== false;
  if (el.customFieldsSheetColumn) el.customFieldsSheetColumn.value = sanitizeSheetColumn(config.customFieldsSheetColumn, defaultConfig.customFieldsSheetColumn);
  renderCustomFieldsSheetControls();
  el.vatPercent.value = config.vatPercent;
  el.paypalFeePercent.value = config.paypalFeePercent;
  el.autoCopy.checked = config.autoCopy;
  el.strictValidation.checked = config.strictValidation;
  el.appendAccounting.checked = config.appendAccounting;
  if (el.accountingPreset) {
    el.accountingPreset.value = ["invoice_standard", "custom_template", "misa_basic", "universal"].includes(config.accountingPreset)
      ? config.accountingPreset
      : "invoice_standard";
  }
  if (el.accountingConnector) el.accountingConnector.value = ["csv", "misa", "quickbooks", "xero", "generic"].includes(config.accountingConnector) ? config.accountingConnector : defaultConfig.accountingConnector;
  if (el.accountingConnectorUrl) el.accountingConnectorUrl.value = config.accountingConnectorUrl || "";
  if (el.accountingConnectorNotes) el.accountingConnectorNotes.value = config.accountingConnectorNotes || "";
  if (el.accountingTemplateText) el.accountingTemplateText.value = config.accountingTemplateText || "";
  el.autoIncrementInvoice.checked = config.autoIncrementInvoice;
  el.autoWriteSheet.checked = config.autoWriteSheet;
  el.enableEmailBridge.checked = false;
  el.bridgeUrl.value = config.bridgeUrl || defaultConfig.bridgeUrl;
  el.fontSize.value = config.fontSize || defaultConfig.fontSize;
  el.primaryColor.value = config.primaryColor || defaultConfig.primaryColor;
  el.panelColor.value = config.panelColor || defaultConfig.panelColor;
  el.rulesText.value = config.rulesText;
  renderProductAliasManager();
  if (el.ruleMode) el.ruleMode.value = config.ruleMode === "custom" ? "custom" : "default";
  el.sourceRulesText.value = config.sourceRulesText || defaultConfig.sourceRulesText;
  document.body.classList.toggle("dark", config.theme === "dark");
  renderThemeToggle();
  fillFontOptions();
  el.fontFamily.value = config.fontFamily || defaultConfig.fontFamily;
  applyAppearance();
  fillDirectionOptions();
  fillProductOptions();
  el.product.value = config.product || "";
  applyLanguage();
  renderGatewaySettings();
  renderSheetTarget();
  renderAccountingConnectorStatus();
}

function applyLanguage() {
  const lang = labels[config.language] ? config.language : "vi";
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((node) => {
    const key = node.getAttribute("data-i18n");
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-placeholder-i18n]").forEach((node) => {
    node.placeholder = t(node.getAttribute("data-placeholder-i18n"));
  });
  document.querySelectorAll("[data-title-i18n]").forEach((node) => {
    node.title = t(node.getAttribute("data-title-i18n"));
  });
  el.languageToggle.textContent = lang.toUpperCase();
  renderSettingsToggle();
  renderThemeToggle();
  renderAccountingConnectorStatus();
  el.rateSource.textContent = el.rateSource.textContent || t("rateSourceEmpty");
  renderRateStatus();
  fillDirectionOptions();
  fillProductOptions();
  renderProductAliasManager();
  renderHistory();
  renderPaymentInbox();
  renderGmailAccount();
  renderSetupChecklist();
  renderSheetPreview(formData());
  if (!records.length) setStatus(t("ready"), "ready");
  if (!workflowContext.emailBridge) setBridgeStatus(t("bridgeStatusIdle"), "idle");
}

async function init() {
  const saved = await storageGet(["config", "historyItems", "gmailAccountEmail"]);
  historyItems = saved.historyItems || [];
  connectedGmail = saved.gmailAccountEmail || "";
  applyConfig(saved.config);
  renderBuildIdentity();
  renderGmailAccount();
  renderHistory();
  renderReviewReadiness({});
  // Invoice date stays blank until the user enters it.
  setGoogleStatus(t("googleReady"), "ready");
  renderEmailBridgeStatus();
  setBridgeStatus(t("bridgeStatusIdle"), "idle");
  setGoogleConnectAvailable();
  renderSettingsToggle();
  setStatus(t("sidePanelReady"), "success");
  renderSmartSuggestions();
  updateProductUndoButtons();
  startRateAutoRefresh();
}

el.autoRun.addEventListener("click", () => buildRows({ copy: true }));
el.buildOnly.addEventListener("click", () => buildRows({ copy: false }));
el.forceCopy.addEventListener("click", () => copyAndSave(true));
el.settingsToggle.addEventListener("click", () => toggleSettingsPanel());
el.getRate.addEventListener("click", refreshRate);
if (el.quickRefreshRate) el.quickRefreshRate.addEventListener("click", () => refreshRate({ silent: false }));
el.saveSettings.addEventListener("click", async () => {
  await saveConfig();
  toggleSettingsPanel(false);
  setSheetFeedback(config.language === "en" ? "Settings saved. Sheet actions are ready." : "Đã lưu cấu hình. Bạn có thể bấm Mở Sheet hoặc Lưu vào Sheet.", "success");
  setStatus(config.language === "en" ? "Settings saved." : "Đã lưu cấu hình.", "success");
});
function handleQuickAddProduct() {
  const amount = el.quickProductAmount ? el.quickProductAmount.value : "";
  const name = el.quickProductName ? el.quickProductName.value : "";
  if (addProductRuleItem(name, amount)) {
    if (el.quickProductAmount) el.quickProductAmount.value = "";
    if (el.quickProductName) el.quickProductName.value = "";
  }
}

function handleInlineAddProduct() {
  const d = formData();
  const name = (el.customProductName && el.customProductName.value.trim()) || el.product.value || d.product;
  const amount = d.usd || "";
  if (addProductRuleItem(name, amount)) {
    if (records[activeIndex]) {
      records[activeIndex].product = name;
      renderForm(records[activeIndex]);
    }
  }
}

function handleSettingsAddProduct() {
  const amount = el.productRuleAmount ? el.productRuleAmount.value : "";
  const name = el.productRuleName ? el.productRuleName.value : "";
  if (addProductRuleItem(name, amount)) {
    if (el.productRuleAmount) el.productRuleAmount.value = "";
    if (el.productRuleName) el.productRuleName.value = "";
  }
}

function handleAddProductAlias() {
  const keywords = el.productAliasKeywords ? el.productAliasKeywords.value : "";
  const name = el.productAliasName ? el.productAliasName.value : "";
  if (addProductAlias(keywords, name)) {
    if (el.productAliasKeywords) el.productAliasKeywords.value = "";
    if (el.productAliasName) el.productAliasName.value = "";
  }
}

function applyRecurringAliasPreset() {
  addProductAlias("subscription, recurring, recurring fee, recurring fees, monthly, per month", config.language === "en" ? "Recurring fees" : "Phí định kỳ / Recurring fees");
  setStatus(t("productAliasPresetApplied"), "success");
}


if (el.openProductRulesSettings) el.openProductRulesSettings.addEventListener("click", () => openSettingsTarget("productRules"));
if (el.openSheetSettingsTip) el.openSheetSettingsTip.addEventListener("click", () => openSettingsTarget("sheet"));
if (el.dismissProductRuleTip) el.dismissProductRuleTip.addEventListener("change", (event) => {
  if (event.target.checked) {
    setTipDismissed("productRules", true);
    renderSmartSuggestions();
    saveConfig();
  }
});
if (el.dismissSheetTip) el.dismissSheetTip.addEventListener("change", (event) => {
  if (event.target.checked) {
    setTipDismissed("sheetSettings", true);
    renderSmartSuggestions();
    saveConfig();
  }
});
if (el.quickProductName) el.quickProductName.addEventListener("focus", maybeShowProductTip);
if (el.quickProductAmount) el.quickProductAmount.addEventListener("focus", maybeShowProductTip);
if (el.product) el.product.addEventListener("focus", maybeShowProductTip);
if (el.product) el.product.addEventListener("change", () => {
  if (el.customProductName) el.customProductName.value = el.product.value || "";
  updateRow();
});
if (el.customProductName) el.customProductName.addEventListener("input", updateRow);
if (el.addCustomField) el.addCustomField.addEventListener("click", () => {
  const d = formData();
  d.customFields = [...cleanCustomFields(d.customFields || []), { name: "", value: "", writeToSheet: true }];
  records[activeIndex] = d;
  renderCustomFields(d.customFields);
});
if (el.customFieldsList) {
  el.customFieldsList.addEventListener("input", () => {
    const d = records[activeIndex] || {};
    d.customFields = collectCustomFields();
    records[activeIndex] = d;
    updateRow();
  });
  el.customFieldsList.addEventListener("change", (event) => {
    if (!event.target.closest("[data-custom-name], [data-custom-value]")) return;
  });
  el.customFieldsList.addEventListener("click", (event) => {
    const writeButton = event.target.closest("[data-custom-write]");
    if (writeButton) {
      writeButton.dataset.state = writeButton.dataset.state === "off" ? "on" : "off";
      writeButton.textContent = writeButton.dataset.state === "off" ? t("sheetFieldWriteOff") : t("sheetFieldWriteOn");
      const d = records[activeIndex] || {};
      d.customFields = collectCustomFields();
      records[activeIndex] = d;
      updateRow();
      return;
    }
    const button = event.target.closest(".custom-field-remove");
    if (!button) return;
    const index = Number(button.dataset.index);
    const d = formData();
    d.customFields = cleanCustomFields(d.customFields).filter((_, itemIndex) => itemIndex !== index);
    records[activeIndex] = d;
    renderCustomFields(d.customFields);
    updateRow();
  });
}
if (el.writeCustomFields) el.writeCustomFields.addEventListener("change", () => {
  renderCustomFieldsSheetControls();
  updateRow();
  scheduleSaveConfig();
});
if (el.customFieldsSheetColumn) el.customFieldsSheetColumn.addEventListener("input", () => {
  el.customFieldsSheetColumn.value = sanitizeSheetColumn(el.customFieldsSheetColumn.value, "");
  updateRow();
  scheduleSaveConfig();
});
if (el.sheetPreviewTable) el.sheetPreviewTable.addEventListener("click", (event) => {
  const button = event.target.closest(".sheet-preview-col");
  if (!button) return;
  const row = button.closest(".sheet-preview-row");
  const label = row && row.children[1] ? row.children[1].textContent.trim() : "";
  editSheetPreviewColumn(button.dataset.sheetField || "", button.dataset.currentColumn || button.textContent.trim(), label);
});
Object.values(el.sheetColumnInputs || {}).forEach((input) => {
  if (!input) return;
  input.addEventListener("input", () => {
    input.value = sanitizeSheetColumn(input.value, "");
    updateRow();
    scheduleSaveConfig();
  });
});
if (el.applyStandardSheetPreset) el.applyStandardSheetPreset.addEventListener("click", () => {
  applySheetColumnPreset(DEFAULT_SHEET_FIELD_COLUMNS, config.language === "en" ? "Standard Sheet preset applied." : "Đã dùng mẫu Sheet phổ thông.");
});
if (el.applyVietnamSheetPreset) el.applyVietnamSheetPreset.addEventListener("click", () => {
  applySheetColumnPreset(VI_ACCOUNTING_SHEET_FIELD_COLUMNS, config.language === "en" ? "Vietnam accounting Sheet preset applied." : "Đã dùng mẫu Sheet kế toán VN.");
});
if (el.sheetName) el.sheetName.addEventListener("focus", maybeShowSheetTip);
if (el.sheetStartCell) el.sheetStartCell.addEventListener("focus", maybeShowSheetTip);

if (el.quickAddProduct) el.quickAddProduct.addEventListener("click", handleQuickAddProduct);
if (el.quickUndoProductChange) el.quickUndoProductChange.addEventListener("click", undoLastProductRuleChange);
if (el.quickDeleteProduct) el.quickDeleteProduct.addEventListener("click", () => deleteProductRuleItem(el.product.value));
if (el.addProductRule) el.addProductRule.addEventListener("click", handleSettingsAddProduct);
if (el.undoProductRuleChange) el.undoProductRuleChange.addEventListener("click", undoLastProductRuleChange);
if (el.addProductAlias) el.addProductAlias.addEventListener("click", handleAddProductAlias);
if (el.applyRecurringAliasPreset) el.applyRecurringAliasPreset.addEventListener("click", applyRecurringAliasPreset);
if (el.productRuleList) el.productRuleList.addEventListener("click", (event) => {
  const button = event.target.closest(".product-rule-delete");
  if (!button) return;
  deleteProductRuleItem(button.dataset.product || "");
});
if (el.productAliasList) el.productAliasList.addEventListener("click", (event) => {
  const button = event.target.closest(".product-alias-delete");
  if (!button) return;
  deleteProductAlias(Number(button.dataset.index));
});

el.saveRules.addEventListener("click", async () => {
  fillProductOptions();
  await saveConfig();
  if (records[activeIndex]) renderForm(formData());
  const sourceCount = currentPaymentSourceRules().length;
  const productCount = currentRules().length;
  setStatus(config.language === "en" ? `Saved ${sourceCount} payment sources and ${productCount} product rules.` : `Đã lưu ${sourceCount} nguồn payment và ${productCount} rule sản phẩm.`, "success");
});
el.resetAppearance.addEventListener("click", async () => {
  el.fontFamily.value = defaultConfig.fontFamily;
  el.fontSize.value = defaultConfig.fontSize;
  el.primaryColor.value = defaultConfig.primaryColor;
  el.panelColor.value = defaultConfig.panelColor;
  applyAppearance();
  await saveConfig();
  setStatus(config.language === "en" ? "Appearance reset." : "Đã đặt lại giao diện.", "success");
});
el.copyRow.addEventListener("click", () => copyAndSave(false));
if (el.quickAddProductInline) el.quickAddProductInline.addEventListener("click", handleInlineAddProduct);
if (el.setupConnectGmail) el.setupConnectGmail.addEventListener("click", connectGmailAccount);
if (el.setupCreateSheet) el.setupCreateSheet.addEventListener("click", setupDefaultSheet);
if (el.setupScanPayments) el.setupScanPayments.addEventListener("click", startPaymentWorkflow);
if (el.loadDemoPayment) el.loadDemoPayment.addEventListener("click", loadDemoPaymentRecord);
if (el.guidedSetupAction) el.guidedSetupAction.addEventListener("click", async () => {
  await runSetupAction(el.guidedSetupAction.dataset.setupAction);
});
if (el.quickFixActions) {
  el.quickFixActions.addEventListener("click", async (event) => {
    const action = event.target.closest("button")?.dataset.fixAction;
    if (!action) return;
    await runSetupAction(action);
  });
}
el.connectGmailAccount.addEventListener("click", connectGmailAccount);
el.disconnectGmailAccount.addEventListener("click", disconnectGmailAccount);
el.copyOAuthExtensionId.addEventListener("click", async () => {
  const extensionId = getGoogleOAuthSetup().extensionId;
  if (!extensionId) return;
  const copied = await safeCopy(extensionId);
  if (copied) setStatus(t("oauthIdCopied"), "success");
});
el.connectGoogle.addEventListener("click", connectGoogle);
el.testSheet.addEventListener("click", testSheetConnection);
if (el.createDefaultSheet) el.createDefaultSheet.addEventListener("click", setupDefaultSheet);
if (el.sheetHealthCard) {
  el.sheetHealthCard.addEventListener("click", async (event) => {
    const action = event.target.closest("button")?.dataset.sheetHealthAction;
    if (action === "check") await testSheetConnection();
    if (action === "fix") await setupDefaultSheet();
  });
}
el.checkBridge.addEventListener("click", checkEmailBridge);
el.syncBridge.addEventListener("click", syncEmailBridge);
el.importBridgePayment.addEventListener("click", importLatestBridgePayment);
el.viewBridgeRecords.addEventListener("click", viewLatestBridgeRecords);
if (el.openBridgeSetup) el.openBridgeSetup.addEventListener("click", openLocalBridgeSetup);
el.quickCheckBridge.addEventListener("click", checkEmailBridge);
el.quickSyncBridge.addEventListener("click", startPaymentWorkflow);
el.quickImportBridgePayment.addEventListener("click", importLatestBridgePayment);
el.quickViewBridgeRecords.addEventListener("click", viewLatestBridgeRecords);
if (el.quickOpenBridgeSetup) el.quickOpenBridgeSetup.addEventListener("click", openLocalBridgeSetup);
el.paymentInboxBody.addEventListener("click", (event) => {
  const row = event.target.closest(".payment-inbox-row");
  if (!row) return;
  selectBridgeInboxRecord(Number(row.dataset.index));
});
el.paymentInboxBody.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const row = event.target.closest(".payment-inbox-row");
  if (!row) return;
  event.preventDefault();
  selectBridgeInboxRecord(Number(row.dataset.index));
});
if (el.bulkCopyReady) el.bulkCopyReady.addEventListener("click", copyReadyPayments);
if (el.bulkSaveReady) el.bulkSaveReady.addEventListener("click", saveReadyPaymentsToSheet);
if (el.sheetActionStatus) el.sheetActionStatus.addEventListener("click", async (event) => {
  const action = event.target.closest("button")?.dataset.sheetAction;
  if (action !== "open-verified") return;
  const url = sheetUrlFromInput(el.sheetUrl.value);
  if (!url) {
    openSheetSettings(config.language === "en" ? "Google Sheet link is missing." : "Chưa có link Google Sheet. Dán link Sheet vào ô đang được chọn.");
    return;
  }
  try {
    await openExternalTab(url);
  } catch (error) {
    setSheetFeedback(config.language === "en" ? `Could not open Sheet: ${error.message}` : `Không mở được Sheet: ${error.message}`, "error");
  }
});
el.writeSheet.addEventListener("click", async () => {
  await ensureFreshRate({ force: true, silent: true });
  const d = formData();
  const missing = missingFields(d);
  const reviewed = d.reviewAccepted === true || d.shouldWriteToRevenueSheet === true || d.manualRevenueOverride === true;
  if (!isRevenueWritable(d, { automatic: false }) && !reviewed) {
    renderWarnings(d);
    setStatus(config.language === "en" ? "Review this payment first, then enable Sheet writing if it is acceptable." : "Hãy kiểm tra payment trước, rồi bật cho phép ghi Sheet nếu dữ liệu chấp nhận được.", "warning");
    return;
  }
  if (d.isDuplicate && !d.duplicateApproved && !reviewed) {
    renderWarnings(d);
    setStatus(t("reviewDuplicateHelp"), "warning");
    return;
  }
  if (missing.length) renderWarnings(d);
  currentRow = makeRow(d);
  el.sheetRow.value = currentRow;
  const wrote = await writeRowsToSheet(currentRow);
  if (!wrote) return;
  if (records[activeIndex] && lastVerifiedSheetWrite) {
    records[activeIndex].sheetWrittenAt = lastVerifiedSheetWriteAt;
    records[activeIndex].writtenToSheet = true;
    records[activeIndex].sheetRange = `${lastVerifiedSheetWrite.sheetName}!${lastVerifiedSheetWrite.range.split("!").pop()}`;
    renderPaymentInbox(bridgeQueueRecords);
    renderForm(records[activeIndex]);
  }
  addHistory(d, currentRow, { writtenToSheet: true });
  if (el.autoIncrementInvoice.checked && el.invoiceNo.value.trim()) {
    el.invoiceNo.value = incrementInvoice(el.invoiceNo.value.trim());
  }
  await saveConfig();
});
el.copyAllRows.addEventListener("click", () => copyAllRows(false));
el.recordSelect.addEventListener("change", () => {
  records[activeIndex] = formData();
  activeIndex = Number(el.recordSelect.value);
  renderForm(records[activeIndex]);
});
el.openSheet.addEventListener("click", async () => {
  const url = sheetUrlFromInput(el.sheetUrl.value);
  if (!url) {
    openSheetSettings(config.language === "en" ? "Google Sheet link is missing." : "Chưa có link Google Sheet. Dán link Sheet vào ô đang được chọn.");
    return;
  }
  try {
    await saveConfig();
    await openExternalTab(url);
    setSheetFeedback(config.language === "en" ? "Google Sheet opened in a new tab." : "Đã mở Google Sheet trong tab mới.", "success");
  } catch (error) {
    const message = config.language === "en" ? `Could not open Sheet: ${error.message}` : `Không mở được Sheet: ${error.message}`;
    setStatus(message, "error");
    setSheetFeedback(message, "error");
  }
});
el.exportCsv.addEventListener("click", exportCsv);
el.dashboardExportCsv.addEventListener("click", exportCsv);
if (el.copyAccountingRow) el.copyAccountingRow.addEventListener("click", copyAccountingRow);
if (el.copyInvoiceDraft) el.copyInvoiceDraft.addEventListener("click", copyInvoiceDraft);
if (el.copyAccountingGuide) el.copyAccountingGuide.addEventListener("click", copyAccountingGuide);
if (el.exportAccountingSample) el.exportAccountingSample.addEventListener("click", exportAccountingSample);
if (el.saveAccountingTemplate) el.saveAccountingTemplate.addEventListener("click", saveAccountingTemplate);
if (el.clearAccountingTemplate) el.clearAccountingTemplate.addEventListener("click", clearAccountingTemplate);
if (el.exportMisaCsv) el.exportMisaCsv.addEventListener("click", exportMisaCsv);
if (el.exportAccountingCsv) el.exportAccountingCsv.addEventListener("click", () => exportAccountingCsv(activeAccountingPreset()));
if (el.accountingPreset) el.accountingPreset.addEventListener("change", () => {
  updateAccountingPreview(formData());
  scheduleSaveConfig();
});
if (el.accountingConnector) el.accountingConnector.addEventListener("change", () => {
  if (el.accountingPreset && activeAccountingPreset() !== "custom_template") {
    el.accountingPreset.value = accountingConnectorDefaultPreset(activeAccountingConnector());
  }
  renderAccountingConnectorStatus();
  updateAccountingPreview(formData());
  scheduleSaveConfig();
});
if (el.accountingConnectorUrl) el.accountingConnectorUrl.addEventListener("input", () => {
  renderAccountingConnectorStatus();
  scheduleSaveConfig();
});
if (el.accountingConnectorNotes) el.accountingConnectorNotes.addEventListener("input", scheduleSaveConfig);
if (el.openAccountingConnector) el.openAccountingConnector.addEventListener("click", async () => {
  const url = el.accountingConnectorUrl ? String(el.accountingConnectorUrl.value || "").trim() : "";
  if (!url) {
    renderAccountingConnectorStatus();
    setStatus(t("accountingConnectorMissingUrl"), "warning");
    return;
  }
  try {
    await saveConfig();
    await openExternalTab(url);
    setStatus(t("accountingConnectorOpened"), "success");
  } catch (error) {
    setStatus(`${t("accountingConnectorOpenFailed")} ${error.message || ""}`.trim(), "error");
  }
});
if (el.accountingTemplateText) el.accountingTemplateText.addEventListener("input", () => {
  if (activeAccountingPreset() === "custom_template") updateAccountingPreview(formData());
  scheduleSaveConfig();
});
el.providerFilter.addEventListener("change", () => renderPaymentInbox());
el.emailTypeFilter.addEventListener("change", () => renderPaymentInbox());
el.sheetStatusFilter.addEventListener("change", () => renderPaymentInbox());
if (el.smartInboxFilters) {
  el.smartInboxFilters.addEventListener("click", (event) => {
    const button = event.target.closest(".smart-filter");
    if (!button) return;
    el.smartInboxFilters.querySelectorAll(".smart-filter").forEach((item) => item.classList.toggle("active", item === button));
    renderPaymentInbox();
  });
}
[el.sheetUrl, el.sheetName, el.sheetStartCell].forEach((input) => {
  input.addEventListener("input", () => {
    renderSheetTarget();
    updateRow();
    scheduleSaveConfig();
  });
  input.addEventListener("change", () => {
    renderSheetTarget();
    updateRow();
    scheduleSaveConfig();
  });
});
el.shouldWriteRevenue.addEventListener("change", () => {
  const d = formData();
  d.writableReason = d.shouldWriteToRevenueSheet
    ? t("manualReviewOverrideReason")
    : tf("notRevenueReason", { status: displayRecordStatus(d.status || "Info"), type: displayEmailType(d.emailType || d.type || "unknown") });
  renderForm(d);
});
el.gatewayRulesList.addEventListener("change", (event) => {
  const index = Number(event.target.dataset.gatewayIndex);
  if (!Number.isInteger(index) || !gatewayRules[index]) return;
  gatewayRules[index].enabled = event.target.checked;
  el.gatewayRulesJson.value = JSON.stringify(gatewayRules, null, 2);
});
if (el.ruleMode) el.ruleMode.addEventListener("change", async () => {
  config.ruleMode = el.ruleMode.value === "custom" ? "custom" : "default";
  renderGatewaySettings();
  await saveConfig();
  setStatus(config.ruleMode === "custom" ? t("ruleModeCustom") : t("ruleModeDefault"), "success");
});
el.saveGatewayRules.addEventListener("click", persistGatewayRules);
if (el.applyRecommendedPresets) el.applyRecommendedPresets.addEventListener("click", applyRecommendedPresets);
if (el.resetPresetRules) el.resetPresetRules.addEventListener("click", applyRecommendedPresets);
el.resetGatewayRules.addEventListener("click", async () => {
  gatewayRules = RevenueFlowRules.getDefaultGatewayRules();
  renderGatewaySettings();
  await persistGatewayRules();
});
el.exportGatewayRules.addEventListener("click", async () => {
  el.gatewayRulesJson.value = JSON.stringify(gatewayRules, null, 2);
  await safeCopy(el.gatewayRulesJson.value);
  setStatus(config.language === "en" ? "Rules JSON copied." : "Đã sao chép JSON rule.", "success");
});
el.importGatewayRules.addEventListener("click", persistGatewayRules);
el.addCustomRule.addEventListener("click", async () => {
  gatewayRules.push(customRuleFromForm());
  renderGatewaySettings();
  await persistGatewayRules();
});
el.testCustomRule.addEventListener("click", () => {
  const result = RevenueFlowRules.testCustomRule(customRuleFromForm(), el.customRuleTestContent.value);
  el.customRuleTestResult.textContent = JSON.stringify(result, null, 2);
});
if (el.reviewAccept) el.reviewAccept.addEventListener("click", () => {
  const d = formData();
  d.reviewAccepted = true;
  d.shouldWriteToRevenueSheet = true;
  d.manualRevenueOverride = true;
  d.duplicateApproved = true;
  d.writableReason = t("manualReviewOverrideReason");
  records[activeIndex] = d;
  renderForm(d);
  setStatus(t("reviewAccepted"), "success");
});
if (el.reviewMore) el.reviewMore.addEventListener("click", () => {
  if (!el.reviewMoreMenu) return;
  el.reviewMoreMenu.hidden = !el.reviewMoreMenu.hidden;
});
if (el.clearCurrentPayment) el.clearCurrentPayment.addEventListener("click", () => {
  const blank = {
    date: todayVN(),
    type: "",
    emailType: "unknown",
    customerName: "",
    customerEmail: "",
    orderNo: "",
    usd: "",
    transactionId: "",
    profileId: "",
    product: "",
    provider: "Payment",
    note: "Payment",
    status: "Info",
    revenueImpact: "none",
    shouldWriteToRevenueSheet: false,
    reviewAccepted: false,
    confidence: {}
  };
  if (!records.length) records.push(blank);
  records[activeIndex] = blank;
  if (el.reviewMoreMenu) el.reviewMoreMenu.hidden = true;
  renderRecordSelector();
  renderForm(blank);
  setStatus(t("currentPaymentCleared"), "success");
});
if (el.removeCurrentPayment) el.removeCurrentPayment.addEventListener("click", () => {
  if (!records.length) return;
  const removed = records[activeIndex];
  records.splice(activeIndex, 1);
  if (removed && removed.sourceMessageId) {
    bridgeQueueRecords = bridgeQueueRecords.filter((record) => record.sourceMessageId !== removed.sourceMessageId);
  }
  activeIndex = Math.max(0, Math.min(activeIndex, records.length - 1));
  if (el.reviewMoreMenu) el.reviewMoreMenu.hidden = true;
  renderRecordSelector();
  renderPaymentInbox(bridgeQueueRecords);
  renderForm(records[activeIndex] || {});
  setStatus(t("currentPaymentRemoved"), "success");
});
el.reviewReadiness.addEventListener("click", (event) => {
  if (!event.target.closest(".confirm-duplicate") || !records[activeIndex]) return;
  records[activeIndex].duplicateApproved = true;
  renderForm(records[activeIndex]);
  setStatus(config.language === "en" ? "Duplicate review confirmed. This payment can now be saved." : "Đã xác nhận kiểm tra trùng. Payment có thể được lưu.", "success");
});
el.clearHistory.addEventListener("click", async () => {
  historyItems = [];
  await storageSet({ historyItems });
  renderHistory();
  setStatus(config.language === "en" ? "History cleared." : "Đã xóa lịch sử.", "success");
});
if (el.exportSettings) el.exportSettings.addEventListener("click", exportSettingsBackup);
if (el.importSettings) el.importSettings.addEventListener("click", () => el.importSettingsFile && el.importSettingsFile.click());
if (el.importSettingsFile) el.importSettingsFile.addEventListener("change", (event) => importSettingsBackup(event.target.files && event.target.files[0]));
el.languageToggle.addEventListener("click", async () => {
  config.language = config.language === "vi" ? "en" : "vi";
  applyLanguage();
  await saveConfig();
});
el.themeToggle.addEventListener("click", async () => {
  document.body.classList.toggle("dark");
  renderThemeToggle();
  applyAppearance();
  await saveConfig();
});
Object.values(el.fields).forEach((input) => input.addEventListener("input", updateRow));
[el.product, el.rate, el.invoiceNo, el.invoiceDate, el.vatPercent, el.paypalFeePercent, el.appendAccounting, el.accountingPreset, el.accountingConnector].filter(Boolean).forEach((input) => {
  input.addEventListener("input", updateRow);
  input.addEventListener("change", updateRow);
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-write-field]");
  if (!button) return;
  const key = button.dataset.writeField;
  const d = records[activeIndex] || {};
  d.sheetFieldWrites = { ...(d.sheetFieldWrites || {}), [key]: button.dataset.state === "off" };
  records[activeIndex] = d;
  renderSheetFieldWriteToggles(d);
  updateRow();
});
if (el.rate) el.rate.addEventListener("input", markManualRateEdited);
[el.autoCopy, el.strictValidation, el.autoIncrementInvoice, el.autoWriteSheet, el.enableEmailBridge].forEach((input) => input.addEventListener("change", scheduleSaveConfig));
[
  el.rate,
  el.invoiceNo,
  el.invoiceDate,
  el.sheetUrl,
  el.targetGmailAccount,
  el.sheetName,
  el.sheetStartCell,
  el.sheetDirection,
  el.bridgeUrl,
  el.vatPercent,
  el.paypalFeePercent,
  el.fontFamily,
  el.fontSize,
  el.primaryColor,
  el.panelColor,
  el.sourceRulesText,
  el.rulesText,
  el.product,
  el.appendAccounting,
  el.accountingPreset,
  el.accountingConnector,
  el.accountingConnectorUrl,
  el.accountingConnectorNotes,
  el.accountingTemplateText
].filter(Boolean).forEach((input) => {
  input.addEventListener("input", () => {
    if ([el.fontFamily, el.fontSize, el.primaryColor, el.panelColor].includes(input)) applyAppearance();
    scheduleSaveConfig();
  });
  input.addEventListener("change", () => {
    if ([el.fontFamily, el.fontSize, el.primaryColor, el.panelColor].includes(input)) applyAppearance();
    scheduleSaveConfig();
  });
});
el.historyList.addEventListener("click", async (event) => {
  const button = event.target.closest(".history-copy");
  if (!button) return;
  const item = historyItems[Number(button.dataset.index)];
  if (!item) return;
  const copied = await safeCopy(item.row);
  if (!copied) return;
  setStatus(config.language === "en" ? "History row copied." : "Đã copy dòng trong lịch sử.", "success");
});

init();
