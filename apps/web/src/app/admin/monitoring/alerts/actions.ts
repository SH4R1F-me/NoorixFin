'use server';

import { acknowledgeAlert as acknowledge } from '../../../../lib/admin';

export async function acknowledgeAlert(alertKey: string) {
  return acknowledge(alertKey);
}
