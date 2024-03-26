export type ClientActions = {
  action: "STATUS_UPDATE",
  fileName: string,
  fileSize?: number,
  status?: string,
  progress?: number,
  report?: ImportReport
};

export type ServerActions = {
  action: "INIT_UPLOAD",
  fileName: string,
  fileSize: number
};

export type ImportReport = {
  recordsCreated: number,
  recordsUpdated: number,
  credentialCount: number
};

export type ImportError = {
  fileName: string,
  line: number,
  error: string
};

export type Row = {
  personId: string,
  first: string,
  last: string,
  cards: string,
  groups: string,
  email: string,
  bluetooth: number,
  mobile: number,
  enabled: number,
  pin: number,
  pinDuress: number,
  activeDate: string,
  expireDate: string,
  [key: `custom.${string}`]: string | number | boolean
};

export type FileData = {
	fileName: string;
	uniqueName: string;
};

export type ProcessResult = {
  status: "ERROR",
  error: string
} | {
  status: "CREATE" | "UPDATE",
  invites: number
};