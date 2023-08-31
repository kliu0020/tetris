// render.ts

import { Key, Event, State } from "./types";
import { Block } from "./constants";

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
   * Renders the current state to the canvas.
   *
   * In MVC terms, this updates the View using the Model.
   * Render shows everything in the game state into the SVG canvas
   * @param s Current state of the game that has everything
   */
export const render = (s: State) => {
    // Going into HTML document looking for #svgCanvas quering the canvas for this element
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
    HTMLElement;
    
    // Going into HTML doc looking for #svgPreview quering the canvas for this element
    const preview = document.querySelector("#svgPreview") as SVGGraphicsElement &
    HTMLElement;

    // Add blocks to the main grid canvas 
    // const cube = createSvgElement(svg.namespaceURI, "rect", {
    //   height: `${Block.HEIGHT}`,
    //   width: `${Block.WIDTH}`,
    //   x: "0",
    //   y: "0",
    //   style: "fill: green",
    // });
    // svg.appendChild(cube);
    // how to make this  function to pass in x and y 
    const cube2 = createSvgElement(svg.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${Block.WIDTH * (s.location.x) }`,
      y: `${Block.HEIGHT * (s.location.y)}`,
      style: "fill: green",
    });
    svg.appendChild(cube2);

    /**
     * Displays a SVG element on the canvas. Brings to foreground.
     * @param elem SVG element to display
     */


    // Add a block to the preview canvas
    const cubePreview = createSvgElement(preview.namespaceURI, "rect", {
      height: `${Block.HEIGHT}`,
      width: `${Block.WIDTH}`,
      x: `${Block.WIDTH * 2}`,
      y: `${Block.HEIGHT}`,
      style: "fill: green",
    });
    preview.appendChild(cubePreview);
  };

export const show = (elem: SVGGraphicsElement) => {
  elem.setAttribute("visibility", "visible");
  elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
export const hide = (elem: SVGGraphicsElement) =>
  elem.setAttribute("visibility", "hidden");
