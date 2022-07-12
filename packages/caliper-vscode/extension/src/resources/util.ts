export interface GeneralObject {
    [index: string]: object;
  }
  export const extractAsKeyValue = (object: GeneralObject) => ({
    key: Object.keys(object)[0],
    value: Object.values(object)[0],
  });