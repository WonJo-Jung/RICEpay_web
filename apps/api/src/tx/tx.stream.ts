import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import type { TxRecord } from '@ricepay/shared';

@Injectable()
export class TxStream {
  private subject = new Subject<TxRecord>();
  push(update: TxRecord) {
    this.subject.next(update);
  }
  observable() {
    return this.subject.asObservable();
  }
}