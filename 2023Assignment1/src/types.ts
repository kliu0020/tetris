type Key = "KeyS" | "KeyA" | "KeyD";

type Event = "keydown" | "keyup" | "keypress";

/** State processing */

type State = Readonly<{
  gameEnd: boolean;
  location: {
    x: number,
    y: number
  };

}>;

export type { Key, Event, State };
