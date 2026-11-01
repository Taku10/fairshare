import { createElement } from "react";

function Card({ as: Element = "div", className = "", children, ...props }) {
  const classes = ["card", className].filter(Boolean).join(" ");
  return createElement(Element, { ...props, className: classes }, children);
}

export default Card;
