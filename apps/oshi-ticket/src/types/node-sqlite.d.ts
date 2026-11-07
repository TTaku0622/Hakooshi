// @types/node 20 には node:sqlite の型がないため、使う部分だけ宣言する（Node 22.5 以降の標準モジュール）
declare module "node:sqlite" {
  type SQLValue = null | number | bigint | string | Uint8Array;

  export class StatementSync {
    run(...params: SQLValue[]): { changes: number | bigint; lastInsertRowid: number | bigint };
    get(...params: SQLValue[]): unknown;
    all(...params: SQLValue[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
