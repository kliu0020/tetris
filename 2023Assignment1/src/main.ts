import "./style.css";
import { fromEvent, interval, merge, BehaviorSubject } from "rxjs";
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
  colour: string;
}>;

type Tetrimino = Readonly<{
  component: ReadonlyArray<Piece>
}>;

type State = Readonly<{
  gameEnd: boolean;
  listOfBlocks: ReadonlyArray<Tetrimino>;
  collisionDetected: boolean;
  generateNewBlock: boolean;
  fallenBlocks: ReadonlyArray<Tetrimino>; 
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
const key$ = fromEvent<KeyboardEvent>(document, "keydown")
const fromKey = (keyCode: string, direction: Direction) =>
key$.pipe(
  filter(({ code }) => code === keyCode),
  map(() => new InputEvent(direction))
);


/**
 * Checks for collisions between an active block and fallen blocks in a Tetris game.
 * @param {Tetrimino} activeBlock - The activeBlock parameter represents the current Tetrimino block
 * that is actively moving on the game board. It contains information about the position and shape of
 * the block.
 * @param fallenBlocks - `fallenBlocks` is an array of Tetrimino objects representing the blocks that
 * have already fallen and are currently on the game board.
 * @param {Direction} [direction=down] - The `direction` parameter is a string that represents the
 * direction in which the collision is being checked. It can have three possible values: "down",
 * "left", or "right".
 * @returns The function `checkCollision` returns a boolean value.
 */
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


/* The classes define three actions for moving a Tetrimino block left, right, and down in a game. */

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

/* The `restartGame` class is an implementation of the `Action` interface in TypeScript that restarts
the game by generating a new seed and resetting the state, while retaining the high score. */
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
/* The hardDrop class is an implementation of the Action interface in TypeScript that applies a hard
drop action to the current state of a Tetris game. */

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



/**
 * Calculates the distance that a Tetrimino can drop without colliding with any fallen
 * blocks.
 * @param {Tetrimino} activeBlock - The activeBlock parameter represents the current Tetrimino that is
 * falling and being controlled by the player. It contains information about the shape and position of
 * the Tetrimino on the game board.
 * @param fallenBlocks - The `fallenBlocks` parameter is an array of Tetrimino objects that represent
 * the blocks that have already fallen and are currently on the game board.
 * @param {number} [initialDistance=0] - The initialDistance parameter represents the number of blocks
 * the activeBlock has dropped so far. It is used to calculate the new y-coordinate of each piece in
 * the activeBlock when checking for collisions with fallenBlocks.
 * @returns the final drop distance of the active block.
 */
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
/**
 * Implements a rotate action for a Tetris game, which rotates the active Tetrimino clockwise around its pivot point.
 * @param component - The `component` parameter in the code refers to an array of objects representing
 * the pieces of a Tetrimino. Each object in the array has properties `x` and `y` which represent the
 * coordinates of the piece on a grid.
 * @returns The code is returning a new state object with the active Tetrimino rotated and replaced in
 * the listOfBlocks array. If a collision is detected with the rotated Tetrimino, the same state object
 * is returned.
 */ 

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

/**
 * Finds the pivot point for the Tetrimino by returning the x and y coordinates
 * of the second piece in the component array.
 * @param component - An array of objects representing the pieces of a Tetrimino. Each object has
 * properties `x` and `y` representing the coordinates of the piece.
 * @returns an object with the properties `x` and `y`, which represent the x and y coordinates of the
 * pivot piece in the "I" shaped Tetrimino.
 */
function findPivotPoint(component: ReadonlyArray<Piece>): { x: number, y: number } {
  // Find the second piece in the "I" shaped Tetrimino.
  // Assumes the component array is sorted by y-coordinate.
  const pivotPiece = component[1];

  return {
    x: parseFloat(pivotPiece.x),
    y: parseFloat(pivotPiece.y)
  };
}
/**
 * Takes in an array of pieces and rotates them around a pivot point.
 * @param component - An array of objects representing the pieces of a tetrimino. Each object has
 * properties `x` and `y` representing the coordinates of the piece on a grid.
 * @returns The function `rotateTetrimino` returns an array of `Piece` objects.
 */

function rotateTetrimino(component: ReadonlyArray<Piece>): Piece[] {
  const pivot = findPivotPoint(component);  // Implement this function to find the pivot point

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

/**
 * Takes a tetrimino and returns a new tetrimino with its components moved down by one block height.
 * @param {Tetrimino} tetrimino - The `tetrimino` parameter is an object that represents a Tetrimino.
 * It has a property called `component` which is an array of objects representing the individual pieces
 * of the Tetrimino. Each piece has properties like `x` and `y` which represent their position on the
 * game
 * @returnsa a new `Tetrimino` object with updated `y` coordinates for each piece in the `component` array.
 */
const makeBlockFall = (tetrimino: Tetrimino): Tetrimino => {
  const newComponent = tetrimino.component.map(piece => ({
    ...piece,
    y: `${parseInt(piece.y) + Block.HEIGHT }`
  }));
  return {
    component: newComponent
  };
};

/* Tetrimino shapes for a Tetris game. 
Each Tetrimino is represented by an object with a "component" property, which is an array of four blocks.
The code defines Tetrimino shapes for the O, I, J, L, Z, S, and T blocks. */
const O_Block: Tetrimino = {
  component: [
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#8fffbf'},
    {x: `${5* Block.WIDTH}`, y: `${-2 *Block.HEIGHT}`, colour: '#8fffbf'},
    {x: `${4* Block.WIDTH}`, y: `${-1 *Block.HEIGHT}`, colour: '#8fffbf'},
    {x: `${5* Block.WIDTH}`, y: `${-1 *Block.HEIGHT}`, colour: '#8fffbf'}
  ]
}

const I_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#67dce4'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#67dce4'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#67dce4'},
    {x: `${3* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#67dce4'},
  ]
}

const J_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#0037ff'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#0037ff'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#0037ff'},
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#0037ff'},
  ]
}

const L_Block: Tetrimino = {
  component: [
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${6* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#ffd48f'},
  ]
}

const Z_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#f892d8'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#f892d8'},
    {x: `${4* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#f892d8'},
    {x: `${3* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#f892d8'},

  ]
}

const S_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${5* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#ffd48f'},
    {x: `${6* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#ffd48f'},
  ]
}

const T_Block: Tetrimino = {
  component: [
    {x: `${5* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#c58fff'},
    {x: `${4* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#c58fff'},
    {x: `${6* Block.WIDTH}`, y: `${-1 * Block.HEIGHT}`, colour: '#c58fff'},
    {x: `${5* Block.WIDTH}`, y: `${-2 * Block.HEIGHT}`, colour: '#c58fff'},
  ]
}

const AllBlocks: Tetrimino[] = [O_Block, I_Block, J_Block, L_Block, Z_Block, S_Block, T_Block];

/* The RNG class is a implementation of a random number generator that generates
floating-point and integer values based on a given seed. */
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
const [initialBlock, seed1] = generateNewBlock(47583);  
const [nextBlock, seed2] = generateNewBlock(seed1);

/**
 * Generates a new Tetrimino block using a random number generator and returns the block
 * along with a new seed value.
 * @param {number} seedValue - The seedValue parameter is a number that is used to initialize the
 * random number generator (RNG). It determines the sequence of random numbers that will be generated.
 * By using the same seed value, you can ensure that the sequence of random numbers is reproducible.
 * @returns The function `generateNewBlock` is returning an array with two elements. The first element
 * is an object with a property `component` that holds the value of `randomBlock.component`. The second
 * element is the value of `newSeed`.
 */
function generateNewBlock(seedValue: number): [Tetrimino, number] {
  const rng = new RNG(seedValue);
  const [randomIndex, newSeed] = rng.getNextInt(0, AllBlocks.length);
  const randomBlock = AllBlocks[randomIndex];

  return [{
      component: randomBlock.component
  }, newSeed];
}

/* Initial Game State  */
const initialState: State = {
  gameEnd: false,
  listOfBlocks: [T_Block],
  collisionDetected: false,
  generateNewBlock: false,
  fallenBlocks: [], 
  score: 0,
  highScore: 0,
  seed: 0,
  level: 1,
} as const;

/**
 * Takes an array of fallen blocks and returns a set of row numbers that are completely filled.
 * @param fallenBlocks - An array of Tetrimino objects representing the blocks that have already fallen
 * on the grid.
 * @returns The function `findFullRows` returns a `Set<number>` containing the indices of the full rows
 * in the grid.
 */
const findFullRows = (fallenBlocks: ReadonlyArray<Tetrimino>): Set<number> => {
  const rowCounts = Array.from({ length: Constants.GRID_HEIGHT }, (_, y) => {
    return fallenBlocks.reduce((count, tetrimino) => {
      return count + tetrimino.component.filter(piece => parseInt(piece.y) === y * Block.HEIGHT).length;
    }, 0);
  });

  const fullRows = new Set<number>(
    rowCounts.map((count, y) => (count >= Constants.GRID_WIDTH ? y : -1)).filter(y => y !== -1)
  );

  return fullRows;
};

/**
 * Takes an array of fallen blocks and a set of full rows, and
 * returns a new array of fallen blocks with the full rows removed and the remaining rows shifted down.
 * @param fallenBlocks - An array of Tetrimino objects representing the blocks that have already fallen
 * on the game board.
 * @param fullRows - The `fullRows` parameter is a Set of numbers representing the rows that are full
 * and need to be removed.
 * @returns Returns a new array of Tetrimino objects.
 */
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

/**
 * Checks if any part of the active block is in the top row.
 * @param {Tetrimino} activeBlock 
 * @param fallenBlocks 
 * @returns a boolean value
 */

const checkGameOver = (activeBlock: Tetrimino, fallenBlocks: ReadonlyArray<Tetrimino>): boolean => {
  const topRowBlocks = activeBlock.component.filter((piece) => parseInt(piece.y) < Block.HEIGHT);
  return topRowBlocks.length > 0;
};


/**
 * Updates the state by proceeding with one time step.
 *
 * @param s Current state
 * @returns Updated state
 */
/**
 * The tick function updates the game state by making the active block fall down and handling
 * collisions with fallen blocks.
 * @param {State} s - Represents the current state of the game. 
 * @returns a new state object with updated properties.
 */
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
        level: newLevel  
      };
  }

  const newActiveBlock = makeBlockFall(activeBlock); // move only the active block down
  return {
    ...s,
    listOfBlocks: [newActiveBlock], 
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
  /* The above code is setting the "visibility" attribute of the "elem" element to "hidden". */
  elem.setAttribute("visibility", "hidden");

/**
 * Creates an SVG element with the given properties.
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

// Render

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
      style: `fill: ${piece.colour}`,
    });
    svg.appendChild(cube);
  });
};

/**
 * Updates the game state by rendering the fallen blocks and the list of blocks
 * on the SVG canvas, and updates the score, high score, and level text.
 * @param {State} s - The parameter "s" is of type "State". It represents the current state of the
 * game, which includes information such as the fallen blocks, the list of blocks, the score, the high
 * score, and the level.
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


// Observables 

  
  /** Determines the rate of time steps */
  class TickEvent {
    constructor() {}
  }
  

  const tick$ = level$.pipe(
    switchMap((level: number) => {
      const adjustedRate = Constants.TICK_RATE_MS - (level * 100);
      return interval(adjustedRate);
    }),
    map(() => new TickEvent())
  );

  const left$ = fromKey("KeyA", "left").pipe(map(_=> new moveLeft()));
  const right$ = fromKey("KeyD", "right").pipe(map(_=> new moveRight()));
  const down$ = fromKey("KeyS", "down").pipe(map(_=> new moveDown()));
  const restart$ = fromKey("KeyR", "Restart").pipe(map(_ => new restartGame()));
  const rotate$ = fromKey("KeyW", "up").pipe(map(_=> new rotate()));
  const hardDrop$ = fromKey("Space", "hardDrop").pipe(map(_ => new hardDrop()));
  const input$ = merge(left$, right$, down$, restart$, rotate$, hardDrop$);

  
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
