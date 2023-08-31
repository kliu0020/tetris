/** State processing */

import { State } from "./types";

// change
export const initialState: State = {
  gameEnd: false,
  location: {
    x: 9,
    y: 19
  },

} as const;
/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
const tick = (s: State) => s;

export { tick };
