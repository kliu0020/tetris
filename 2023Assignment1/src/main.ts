/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";

import { fromEvent, interval, merge } from "rxjs";
import { map, filter, scan } from "rxjs/operators";

/** Constants */

const Viewport = {
  CANVAS_WIDTH: 200,
  CANVAS_HEIGHT: 400,
  PREVIEW_WIDTH: 160,
  PREVIEW_HEIGHT: 80,
} as const;

const Constants = {
  TICK_RATE_MS: 500,
  GRID_WIDTH: 10,
  GRID_HEIGHT: 20,
} as const;

const Block = {
  WIDTH: Viewport.CANVAS_WIDTH / Constants.GRID_WIDTH,
  HEIGHT: Viewport.CANVAS_HEIGHT / Constants.GRID_HEIGHT,
};

/** User input */

type Key = "KeyS" | "KeyA" | "KeyD";
type Direction = "left" | "up" | "right" | "down";
type Event = "keydown" | "keyup" | "keypress";

interface Action {
  apply(s: State): State;
}

class moveLeft implements Action {
  apply = (s:State) => {
    // do calculations to move the tetris piece to the left
    return { // everything here is the changes made to the state
      ...s, // change the stuff relevant to our thing
    }
  }
}


/** Utility functions */
const key$ = fromEvent<KeyboardEvent>(document, "keydown");

const fromKey = (keyCode: string, direction: Direction) =>
key$.pipe(
  filter(({ code }) => code === keyCode),
  map(() => new InputEvent(direction))
);

const left$ = fromKey("KeyA", "left").pipe(map(_=> new moveLeft()));
const right$ = fromKey("KeyD", "right");
const down$ = fromKey("KeyS", "down");
const input$ = merge(left$, right$, down$);

/** State processing */

// Everything in Piece needs to be a string
type Piece = Readonly<{
  x: string;
  y: string;
  color: string;
}>;

type Tetrimino = Readonly<{
  component: ReadonlyArray<Piece>
}>;

type State = Readonly<{
  gameEnd: boolean;
  listOfBlocks: ReadonlyArray<Tetrimino>
  // have a list of all the blocks even the ones that stopped
  collisionDetected: boolean;
}>;

const TwoByTwo: Tetrimino = {
  component: [
    {x: `${4* Block.WIDTH}`, y: `${Block.HEIGHT}`, color: 'green'},
    {x: `${5* Block.WIDTH}`, y: `${Block.HEIGHT}`, color: 'green'},
    {x: `${4* Block.WIDTH}`, y: `${2*Block.HEIGHT}`, color: 'green'},
    {x: `${5* Block.WIDTH}`, y: `${2*Block.HEIGHT}`, color: 'green'}
  ]
}

const initialState: State = {
  gameEnd: false,
  listOfBlocks: [TwoByTwo],
  collisionDetected: false,
} as const;

// maps a piece down y 
const makeBlockFall = (tetrimino: Tetrimino): Tetrimino => {
  const newComponent = tetrimino.component.map(piece => ({
    ...piece,
    y: `${parseInt(piece.y) + Block.HEIGHT}`
  }));
  return {
    component: newComponent
  };
};

// generates a new block
// const generateNewBlock = () => {
//   return TwoByTwo;
// }

// Function checks for collision on the floor
const checkCollision = (activeBlock: Tetrimino): boolean => {
  return activeBlock.component.reduce((collisionDetected, piece) => {
    const y = parseFloat(piece.y);
    return collisionDetected || (y + Block.HEIGHT >= Viewport.CANVAS_HEIGHT);
  }, false);
};


/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
// create function that makes it fall down and put it in tick
const tick = (s: State): State => {
  const newListOfBlocks = s.listOfBlocks.map(makeBlockFall);
  const activeBlock = s.listOfBlocks[0]; 
  if (checkCollision(activeBlock)) {
    return { 
      ...s, collisionDetected: true 
      };
  }
  return {
    ...s,
    listOfBlocks: newListOfBlocks
  };
};

/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
  namespace: string | null,
  name: string,
  props: Record<string, string> = {}
) => {
  const elem = document.createElementNS(namespace, name) as SVGElement;
  Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
  return elem;
};

/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main() {
  // Canvas elements
  const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
  const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;
  const gameover = document.querySelector("#gameOver") as SVGGraphicsElement &
    HTMLElement;
  const container = document.querySelector("#main") as HTMLElement;

  svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
  svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);
  preview.setAttribute("height", `${Viewport.PREVIEW_HEIGHT}`);
  preview.setAttribute("width", `${Viewport.PREVIEW_WIDTH}`);

  // Text fields
  const levelText = document.querySelector("#levelText") as HTMLElement;
  const scoreText = document.querySelector("#scoreText") as HTMLElement;
  const highScoreText = document.querySelector("#highScoreText") as HTMLElement;

  /** User input */

  /** Observables */

  /** Determines the rate of time steps */
  // const tick$ = interval(Constants.TICK_RATE_MS).pipe(map(() => tick))
  class TickEvent {
    constructor() {}
  }
  
  const tick$ = interval(10).pipe(map(() => new TickEvent()));


  // 
  const source$ = merge(input$, tick$);
  /**
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   *
   * @param s Current state
   */
  const render = (s: State) => {
    // Clear the previous rendering
    while (svg.lastChild) {
      svg.removeChild(svg.lastChild);
    }
  
    s.listOfBlocks.forEach(tetrimino => {
      tetrimino.component.forEach(piece => {
        const cube = createSvgElement(svg.namespaceURI, "rect", {
          height: `${Block.HEIGHT}`,
          width: `${Block.WIDTH}`,
          x: piece.x,
          y: piece.y,
          style: `fill: ${piece.color}`,
        });
        svg.appendChild(cube);
      });
    });
  
    // ... (other rendering logic)
  };
  


  const source$ = merge(tick$)
  .pipe(scan((s: State) => tick(s), initialState))
  .subscribe((s: State) => {
    render(s);

    if (s.gameEnd) {
      show(gameover);
    } else {
      hide(gameover);
    }
  });

}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}
