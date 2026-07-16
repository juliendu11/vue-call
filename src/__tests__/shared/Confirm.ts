import { createCallable } from '../../createCallable'
import ConfirmComponent from './Confirm.vue'

export const Confirm = createCallable<
  { message: string },
  boolean,
  Record<string, never>
>(ConfirmComponent)
