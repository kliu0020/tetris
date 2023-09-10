import { assert, describe, expect, it } from "vitest";
import { main } from "../src/main";



describe("main", () => {
  // ... existing tests

  it("should initialize SVG elements", () => {
    main();
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement & HTMLElement;
    const preview = document.querySelector("#svgPreview") as SVGGraphicsElement & HTMLElement;
    const gameover = document.querySelector("#gameOver") as SVGGraphicsElement & HTMLElement;
    assert.isDefined(svg);
    assert.isDefined(preview);
    assert.isDefined(gameover);
  });

  describe("renderTetrimino", () => {
    it("should render a Tetrimino on the SVG canvas", () => {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGGraphicsElement;
      const tetrimino = {
        component: [
          { x: 0, y: 0, color: "red" },
          { x: 10, y: 10, color: "blue" },
        ],
      };
      renderTetrimino(tetrimino, svg);
      const rectElements = svg.querySelectorAll("rect");
      assert.equal(rectElements.length, 2);
    });
  });

  describe("render", () => {
    it("should update score, high score, and level text", () => {
      const s = {
        score: 100,
        highScore: 200,
        level: 2,
        fallenBlocks: [],
        listOfBlocks: [],
      };
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg") as SVGGraphicsElement;
      const scoreText = document.createElement("div");
      const highScoreText = document.createElement("div");
      const levelText = document.createElement("div");
      render(s, svg, scoreText, highScoreText, levelText);
      assert.equal(scoreText.innerText, "100");
      assert.equal(highScoreText.innerText, "200");
      assert.equal(levelText.innerText, "2");
    });
  });
});