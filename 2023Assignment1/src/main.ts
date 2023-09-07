import "./style.css";
import { fromEvent, interval, merge, pipe } from "rxjs";
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
  listOfBlocks: ReadonlyArray<Tetrimino>;
  collisionDetected: boolean;
  generateNewBlock: boolean;
  doneFallingBlocks: ReadonlyArray<Tetrimino>; // <-- New field
}>;

type Key = "KeyS" | "KeyA" | "KeyD";
type Direction = "left" | "up" | "right" | "down";
type Event = "keydown" | "keyup" | "keypress";

interface Action {
  apply(s: State): State;
}

/** Utility functions */
const key$ = fromEvent<KeyboardEvent>(document, "keydown");

const fromKey = (keyCode: string, direction: Direction) =>
key$.pipe(
  filter(({ code }) => code === keyCode),
  map(() => new InputEvent(direction))
);

const left$ = fromKey("KeyA", "left").pipe(map(_=> new moveLeft()));
const right$ = fromKey("KeyD", "right").pipe(map(_=> new moveRight()));
const down$ = fromKey("KeyS", "down").pipe(map(_=> new moveDown()));
const input$ = merge(left$, right$, down$);


const checkCollision = (activeBlock: Tetrimino, doneFallingBlocks: ReadonlyArray<Tetrimino>, direction: Direction = "down"): boolean => {
  return activeBlock.component.reduce((collisionDetected, piece) => {
    const y = parseFloat(piece.y);
    const x = parseFloat(piece.x);

    // Check for floor collision
    const floorCollision = (y + Block.HEIGHT >= Viewport.CANVAS_HEIGHT);

    // Check for side collisions
    const leftCollision = (direction === "left" && x - Block.WIDTH < 0);
    const rightCollision = (direction === "right" && x + Block.WIDTH >= Viewport.CANVAS_WIDTH);

    // Check for block collisions
    const blockCollision = doneFallingBlocks.reduce((acc, tetrimino) => {
      return acc || tetrimino.component.reduce((innerAcc, piece) => {
        const otherX = parseFloat(piece.x);
        const otherY = parseFloat(piece.y);
        
        const samePosition = (direction === "down" && x === otherX && y + Block.HEIGHT === otherY)
          || (direction === "left" && y === otherY && x - Block.WIDTH === otherX)
          || (direction === "right" && y === otherY && x + Block.WIDTH === otherX);

        return innerAcc || samePosition;
      }, false);
    }, false);

    return collisionDetected || floorCollision || leftCollision || rightCollision || blockCollision;
  }, false);
};


class moveLeft implements Action {
  apply = (s: State): State => {
    // Fetch the active Tetrimino block
    const activeBlock = s.listOfBlocks[0];

    if(checkCollision(activeBlock, s.doneFallingBlocks, "left")) {
      return s; // Return the same state if collision detected
    }
    // Move each piece of the Tetrimino one unit to the left
    const movedBlock: Tetrimino = {
      component: activeBlock.component.map((piece) => ({
        ...piece,
        x: `${parseFloat(piece.x) - Block.WIDTH}`
      })),
    };

    // Replace the active Tetrimino with the moved Tetrimino
    const newListOfBlocks = [movedBlock, ...s.listOfBlocks.slice(1)];

    // Return the new state
    return {
      ...s,
      listOfBlocks: newListOfBlocks
    };
  }
}

class moveRight implements Action {
  apply = (s: State): State => {
    // Fetch the active Tetrimino block
    const activeBlock = s.listOfBlocks[0];

    if(checkCollision(activeBlock, s.doneFallingBlocks, "right")) {
      return s; // Return the same state if collision detected
    }

    // Move each piece of the Tetrimino one unit to the left
    const movedBlock: Tetrimino = {
      component: activeBlock.component.map((piece) => ({
        ...piece,
        x: `${parseFloat(piece.x) + Block.WIDTH}`
      })),
    };

    // Replace the active Tetrimino with the moved Tetrimino
    const newListOfBlocks = [movedBlock, ...s.listOfBlocks.slice(1)];

    // Return the new state
    return {
      ...s,
      listOfBlocks: newListOfBlocks
    };
  }
}

class moveDown implements Action {
  apply = (s: State): State => {
    // Fetch the active Tetrimino block
    const activeBlock = s.listOfBlocks[0];
    if(checkCollision(activeBlock, s.doneFallingBlocks, "down")) {
      return s; // Return the same state if collision detected
    }

    // Move each piece of the Tetrimino one unit to the left
    const movedBlock: Tetrimino = {
      component: activeBlock.component.map((piece) => ({
        ...piece,
        y: `${parseFloat(piece.y) + Block.HEIGHT}`
      })),
    };

    // Replace the active Tetrimino with the moved Tetrimino
    const newListOfBlocks = [movedBlock, ...s.listOfBlocks.slice(1)];

    // Return the new state
    return {
      ...s,
      listOfBlocks: newListOfBlocks
    };
  }
}

const makeBlockFall = (tetrimino: Tetrimino): Tetrimino => {
  const newComponent = tetrimino.component.map(piece => ({
    ...piece,
    y: `${parseInt(piece.y) + Block.HEIGHT}`
  }));
  return {
    component: newComponent
  };
};

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
  generateNewBlock: false,
  doneFallingBlocks: [] // <-- Initialize with empty array
} as const;

// generates a new block
const generateNewBlock = (): Tetrimino => {
  return TwoByTwo;
}

const findFullRows = (doneFallingBlocks: ReadonlyArray<Tetrimino>): Set<number> => {
  const fullRows = new Set<number>();

  for (let y = 0; y < Constants.GRID_HEIGHT; y++) {
    let blockCount = 0;
    for (const tetrimino of doneFallingBlocks) {
      for (const piece of tetrimino.component) {
        if (parseInt(piece.y) === y * Block.HEIGHT) {
          blockCount++;
        }
      }
    }
    if (blockCount >= Constants.GRID_WIDTH) {
      fullRows.add(y);
    }
  }

  return fullRows;
};

const removeAndShiftRows = (doneFallingBlocks: ReadonlyArray<Tetrimino>, fullRows: Set<number>): ReadonlyArray<Tetrimino> => {
  const newBlocks: Tetrimino[] = [];

  doneFallingBlocks.forEach(tetrimino => {
    let newComponent: Piece[] = [];
    tetrimino.component.forEach(piece => {
      const row = parseInt(piece.y) / Block.HEIGHT;
      if (!fullRows.has(row)) {
        let newRow = row;
        Array.from(fullRows).forEach(fullRow => {
          if (row < fullRow) newRow++;
        });
        newComponent.push({ ...piece, y: `${newRow * Block.HEIGHT}` });
      }
    });

    if (newComponent.length > 0) {
      newBlocks.push({ component: newComponent });
    }
  });

  return newBlocks;
};


/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
// create function that makes it fall down and put it in tick
const tick = (s: State): State => {
  const activeBlock = s.listOfBlocks[0];
  if (checkCollision(activeBlock, s.doneFallingBlocks, "down")) {
    const newBlock = generateNewBlock();
    const fullRows = findFullRows([...s.doneFallingBlocks, activeBlock]);
    const newDoneFallingBlocks = removeAndShiftRows([...s.doneFallingBlocks, activeBlock], fullRows);
    
    return {
      ...s,
      listOfBlocks: [newBlock],  // Only include the new block here
      doneFallingBlocks: newDoneFallingBlocks,
      collisionDetected: true
    };
  }
  
  const newActiveBlock = makeBlockFall(activeBlock); // move only the active block down
  return {
    ...s,
    listOfBlocks: [newActiveBlock],  // Only include the new active block here
    collisionDetected: false
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

  /** Determines the rate of time steps */
  class TickEvent {
    constructor() {}
  }
  
  const tick$ = interval(100).pipe(map(() => new TickEvent()));

/**
 * Renders a Tetrimino piece on the SVG canvas.
 *
 * @param tetrimino Tetrimino to render
 * @param svg SVG canvas element
 */
const renderTetrimino = (tetrimino: Tetrimino, svg: SVGGraphicsElement) => {
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
};

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
    s.doneFallingBlocks.forEach(tetrimino => renderTetrimino(tetrimino, svg));
    s.listOfBlocks.forEach(tetrimino => renderTetrimino(tetrimino, svg));

  };
  
  const source$ = merge(input$, tick$)
  .pipe(
    scan((s: State, action: Action | TickEvent) => 
      action instanceof TickEvent ? tick(s) : action.apply(s),
    initialState)
  )
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
