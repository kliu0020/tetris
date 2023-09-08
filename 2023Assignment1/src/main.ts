import "./style.css";
import { fromEvent, interval, merge, pipe, behav, BehaviorSubject, combineLatest } from "rxjs";
import { map, filter, scan, switchMap } from "rxjs/operators";

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
  fallenBlocks: ReadonlyArray<Tetrimino>; // <-- New field
  score: number;
  highScore: number;
  seed: number;
  level: number;
}>;

type Key = "KeyS" | "KeyA" | "KeyD" | "KeyR" | "KeyW" | "Space";
type Direction = "left" | "up" | "right" | "down" | "Restart" | "hardDrop";
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
const restart$ = fromKey("KeyR", "Restart").pipe(map(_ => new restartGame()));
const rotate$ = fromKey("KeyW", "up").pipe(map(_=> new rotate()));
const hardDrop$ = fromKey("Space", "hardDrop").pipe(map(_ => new hardDrop()));
const input$ = merge(left$, right$, down$, restart$, rotate$, hardDrop$);

const processActions = (s: State, action: Action): State => {
  return action.apply(s);
};

const checkCollision = (activeBlock: Tetrimino, fallenBlocks: ReadonlyArray<Tetrimino>, direction: Direction = "down"): boolean => {
  return activeBlock.component.reduce((collisionDetected, piece) => {
    const y = parseFloat(piece.y);
    const x = parseFloat(piece.x);

    // Check for floor collision
    const floorCollision = (y + Block.HEIGHT >= Viewport.CANVAS_HEIGHT);

    // Check for side collisions
    const leftCollision = (direction === "left" && x - Block.WIDTH < 0);
    const rightCollision = (direction === "right" && x + Block.WIDTH >= Viewport.CANVAS_WIDTH);

    // Check for block collisions
    const blockCollision = fallenBlocks.reduce((acc, tetrimino) => {
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

    if(checkCollision(activeBlock, s.fallenBlocks, "left")) {
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

    if(checkCollision(activeBlock, s.fallenBlocks, "right")) {
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
    if(checkCollision(activeBlock, s.fallenBlocks, "down")) {
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

class restartGame implements Action {
  apply(s: State): State {
    if (s.gameEnd) {
      const rng = new RNG(s.seed);
      const newSeed = rng.generateNextSeed();

      return {
        ...initialState,
        seed: newSeed,
        highScore: s.highScore // retain high score
      };
    }
    return s;
  }
}

class hardDrop implements Action {
  apply = (s: State): State => {
    const activeBlock = s.listOfBlocks[0];

    // Calculate how much distance to drop
    const dropDistance = calculateDropDistance(activeBlock, s.fallenBlocks);

    // If dropDistance is zero, then it's already touching another block or the floor
    if (dropDistance <= 0) {
      return s;
    }

    const hardDroppedBlock: Tetrimino = {
      component: activeBlock.component.map((piece) => ({
        ...piece,
        y: `${parseFloat(piece.y) + (Block.HEIGHT * dropDistance)}`
      }))
    };

    const newListOfBlocks = [hardDroppedBlock, ...s.listOfBlocks.slice(1)];

    return {
      ...s,
      listOfBlocks: newListOfBlocks
    };
  }
}



function calculateDropDistance(activeBlock: Tetrimino, fallenBlocks: ReadonlyArray<Tetrimino>, initialDistance: number = 0): number {
  if (checkCollision(
    { component: activeBlock.component.map(piece => ({
        ...piece,
        y: `${parseFloat(piece.y) + (Block.HEIGHT * initialDistance)}`
      }))},
    fallenBlocks, 
    "down"
  )) {
    return initialDistance;
  }
  return calculateDropDistance(activeBlock, fallenBlocks, initialDistance + 1);
}

class rotate implements Action {
  apply = (s: State): State => {
    const activeBlock = s.listOfBlocks[0];
    
    // Deep clone the component array
    const clonedComponent = JSON.parse(JSON.stringify(activeBlock.component));
    const rotatedComponent = rotateTetrimino(clonedComponent);

    // Create a rotated block to check for collisions
    const rotatedBlock: Tetrimino = {
      component: rotatedComponent
    };

    // Check for collisions with the rotated block
    if(checkCollision(rotatedBlock, s.fallenBlocks)) {
      return s; // Return the same state if collision detected
    }

    // Replace the active Tetrimino with the rotated Tetrimino
    const newListOfBlocks = [rotatedBlock, ...s.listOfBlocks.slice(1)];

    // Return the new state
    return {
      ...s,
      listOfBlocks: newListOfBlocks
    };
  }
}

function findPivotForI(component: ReadonlyArray<Piece>): { x: number, y: number } {
  // Find the second piece in the "I" shaped Tetrimino.
  // Assumes the component array is sorted by y-coordinate.
  const pivotPiece = component[1];

  return {
    x: parseFloat(pivotPiece.x),
    y: parseFloat(pivotPiece.y)
  };
}

function rotateTetrimino(component: ReadonlyArray<Piece>): Piece[] {
  const pivot = findPivotForI(component);  // Implement this function to find the pivot point

  return component.map(piece => {
    // Assuming piece.x and piece.y are numbers
    const x = parseFloat(piece.x);
    const y = parseFloat(piece.y);

    // Rotate around pivot
    const newX = pivot.x + (y - pivot.y);
    const newY = pivot.y - (x - pivot.x);

    return { ...piece, x: `${newX}`, y: `${newY}` };
  });
}

const makeBlockFall = (tetrimino: Tetrimino): Tetrimino => {
  const newComponent = tetrimino.component.map(piece => ({
    ...piece,
    y: `${parseInt(piece.y) + Block.HEIGHT }`
  }));
  return {
    component: newComponent
  };
};

const O_Block: Tetrimino = {
  component: [
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#8fffbf'},
    {x: `${5* Block.WIDTH}`, y: `${-2 *Block.HEIGHT}`, color: '#8fffbf'},
    {x: `${4* Block.WIDTH}`, y: `${-1 *Block.HEIGHT}`, color: '#8fffbf'},
    {x: `${5* Block.WIDTH}`, y: `${-1 *Block.HEIGHT}`, color: '#8fffbf'}
  ]
}

const I_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#67dce4'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#67dce4'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#67dce4'},
    {x: `${3* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#67dce4'},
  ]
}

const J_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#0037ff'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#0037ff'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#0037ff'},
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#0037ff'},
  ]
}

const L_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${6* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#ffd48f'},
  ]
}

const Z_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#f892d8'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#f892d8'},
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#f892d8'},
    {x: `${3* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#f892d8'},

  ]
}

const S_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${5* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#ffd48f'},
    {x: `${6* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#ffd48f'},
  ]
}

const T_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#c58fff'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#c58fff'},
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, color: '#c58fff'},
    {x: `${5* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, color: '#c58fff'},
  ]
}

const AllBlocks: Tetrimino[] = [O_Block, I_Block, J_Block, L_Block, Z_Block, S_Block, T_Block];

class RNG {
  public static readonly MODULUS = 0x80000000; // 2**31
  public static readonly MULTIPLIER = 123123;
  public static readonly INCREMENT = 12345;

  public currentSeed: number;

  constructor(initialSeed: number) {
    this.currentSeed = initialSeed;
  }
  /**
   * Generates the next seed value in the sequence.
   */
  public generateNextSeed(): number {
    this.currentSeed = (RNG.MULTIPLIER * this.currentSeed + RNG.INCREMENT) % RNG.MODULUS;
    return this.currentSeed;
  }

  public getNextFloat(): [number, number] {
    const nextSeed = this.generateNextSeed();
    return [nextSeed / RNG.MODULUS, nextSeed];
  }

  public getNextInt(boundaryLower: number, boundaryUpper: number): [number, number] {
    const [fraction, nextSeed] = this.getNextFloat();
    return [Math.floor(boundaryLower + fraction * (boundaryUpper - boundaryLower)), nextSeed];
  }
}

// Initialises the game state 
const [initialBlock, seed1] = generateNewBlock(12345);  // Starting seed
const [nextBlock, seed2] = generateNewBlock(seed1);

function generateNewBlock(seedValue: number): [Tetrimino, number] {
  const rng = new RNG(seedValue);
  const [randomIndex, newSeed] = rng.getNextInt(0, AllBlocks.length);
  const randomBlock = AllBlocks[randomIndex];

  return [{
      component: randomBlock.component
  }, newSeed];
}

const initialState: State = {
  gameEnd: false,
  listOfBlocks: [T_Block],
  collisionDetected: false,
  generateNewBlock: false,
  fallenBlocks: [], // <-- Initialize with empty array
  score: 0,
  highScore: 0,
  seed: 0,
  level: 1,
} as const;

const findFullRows = (fallenBlocks: ReadonlyArray<Tetrimino>): Set<number> => {
  const fullRows = new Set<number>();

  for (let y = 0; y < Constants.GRID_HEIGHT; y++) {
    let blockCount = 0;
    for (const tetrimino of fallenBlocks) {
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

const removeAndShiftRows = (
  fallenBlocks: ReadonlyArray<Tetrimino>,
  fullRows: Set<number>
): ReadonlyArray<Tetrimino> => {
  return fallenBlocks.map(tetrimino => {
    const newComponent = tetrimino.component
      .filter(piece => {
        const row = parseInt(piece.y) / Block.HEIGHT;
        return !fullRows.has(row);
      })
      .map(piece => {
        const row = parseInt(piece.y) / Block.HEIGHT;
        const newRow = Array.from(fullRows).reduce(
          (acc, fullRow) => (row < fullRow ? acc + 1 : acc),
          row
        );
        return { ...piece, y: `${newRow * Block.HEIGHT}` };
      });
      
    return { component: newComponent };
  }).filter(tetrimino => tetrimino.component.length > 0);
};

const checkGameOver = (activeBlock: Tetrimino, fallenBlocks: ReadonlyArray<Tetrimino>): boolean => {
  // Check if any part of the active block is in the top row
  return activeBlock.component.some((piece) => parseInt(piece.y) < Block.HEIGHT);
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

  if (checkCollision(activeBlock, s.fallenBlocks, "down")) {
    const [newBlock, newSeed] = generateNewBlock(s.seed);
    const fullRows = findFullRows([...s.fallenBlocks, activeBlock]);
    const linesCleared = fullRows.size;
    const newScore = s.score + linesCleared;
    const newHighScore = Math.max(s.highScore, newScore);
    const newfallenBlocks = removeAndShiftRows([...s.fallenBlocks, activeBlock], fullRows);

    const newLevel = Math.floor(newScore / 2) + 1;

    // Update the BehaviorSubject
    level$.next(newLevel);

    const isGameOver = checkGameOver(activeBlock, s.fallenBlocks);
    return {
      ...s,
      gameEnd: isGameOver,
      listOfBlocks: [newBlock],
      seed: newSeed,
      fallenBlocks: newfallenBlocks,
      collisionDetected: true,
      score: newScore,
      highScore: newHighScore,
      level: newLevel  // Update level
    };
  }
  
  const newActiveBlock = makeBlockFall(activeBlock); // move only the active block down
  return {
    ...s,
    listOfBlocks: [newActiveBlock],  // Only include the new active block here
    collisionDetected: false
  };
};


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

const level$ = new BehaviorSubject<number>(initialState.level); // starts at level 1

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
  
  const level$ = new BehaviorSubject<number>(1); // Initialize level at 1

  const tick$ = level$.pipe(
    switchMap((level: number) => {
      const adjustedRate = Constants.TICK_RATE_MS - (level * 100);
      return interval(adjustedRate);
    }),
    map(() => new TickEvent())
  );
  
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
    const showGameOver = svg.querySelectorAll("rect:not(#gameOver rect)")
    showGameOver.forEach(rect => rect.remove())
    s.fallenBlocks.forEach(tetrimino => renderTetrimino(tetrimino, svg));
    s.listOfBlocks.forEach(tetrimino => renderTetrimino(tetrimino, svg));
    scoreText.innerText = `${s.score}`;
    highScoreText.innerText = `${s.highScore}`;
    levelText.innerText = `${s.level}`;
  };
  
  const source$ = merge(input$, tick$)
  .pipe(
    scan((s: State, action: Action | TickEvent) => 
      action instanceof TickEvent ? tick(s) : action.apply(s),
    initialState)
  )
  .subscribe((s: State) => {
    
    if (s.gameEnd) {
      show(gameover);
    } else {
      render(s);
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
