/**
 * The OOCC design-refusal ESLint rules — docs/PRD.md §6: no gradients, no
 * glassmorphism, no emoji icons / sparkle badges. Plain flat-config plugin
 * object (no published package needed for three rules).
 */

// Tailwind v3 named these `bg-gradient-to-r` + `from-*`/`via-*`/`to-*`; v4
// renamed the directional utility to `bg-linear-*` (plus `bg-radial*` /
// `bg-conic*`) but kept the color-stop utilities. Ban both eras.
const GRADIENT_PATTERN = /^(bg-gradient-|bg-linear-|bg-radial\b|bg-radial-|bg-conic\b|bg-conic-|from-|via-|to-)/;
const BACKDROP_BLUR_PATTERN = /^backdrop-blur/;
const EMOJI_PATTERN = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function collectStringLiterals(expr, acc = []) {
  if (!expr) return acc;
  switch (expr.type) {
    case "Literal":
      if (typeof expr.value === "string") acc.push(expr);
      break;
    case "TemplateLiteral":
      for (const quasi of expr.quasis) {
        if (quasi.value.cooked) acc.push({ value: quasi.value.cooked, loc: quasi.loc, range: quasi.range });
      }
      break;
    case "ConditionalExpression":
      collectStringLiterals(expr.consequent, acc);
      collectStringLiterals(expr.alternate, acc);
      break;
    case "LogicalExpression":
      collectStringLiterals(expr.left, acc);
      collectStringLiterals(expr.right, acc);
      break;
    case "CallExpression":
      for (const arg of expr.arguments) collectStringLiterals(arg, acc);
      break;
  }
  return acc;
}

function classNameToken(token) {
  return token.includes(":") ? token.slice(token.lastIndexOf(":") + 1) : token;
}

const noDecorativeUtilities = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow gradient and backdrop-blur utility classes (docs/PRD.md §6: no gradients, no glassmorphism).",
    },
    schema: [],
    messages: {
      noGradient: 'Gradient utility "{{utility}}" is not allowed. docs/PRD.md §6 rules out gradients.',
      noBackdropBlur:
        'backdrop-blur utility "{{utility}}" is not allowed. docs/PRD.md §6 rules out glassmorphism.',
    },
  },
  create(context) {
    function checkLiteral(literalNode) {
      if (typeof literalNode.value !== "string") return;
      for (const rawToken of literalNode.value.split(/\s+/)) {
        if (!rawToken) continue;
        const utility = classNameToken(rawToken);
        if (GRADIENT_PATTERN.test(utility)) {
          context.report({ node: literalNode, messageId: "noGradient", data: { utility } });
        } else if (BACKDROP_BLUR_PATTERN.test(utility)) {
          context.report({ node: literalNode, messageId: "noBackdropBlur", data: { utility } });
        }
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.type !== "JSXIdentifier") return;
        if (node.name.name !== "className" && node.name.name !== "class") return;
        if (!node.value) return;

        if (node.value.type === "Literal") {
          checkLiteral(node.value);
        } else if (node.value.type === "JSXExpressionContainer") {
          for (const literal of collectStringLiterals(node.value.expression)) {
            checkLiteral(literal);
          }
        }
      },
    };
  },
};

const noEmojiJsx = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow emoji in JSX text/attributes (docs/PRD.md §6: no emoji icons, no sparkle badges). Apply this rule everywhere except content files (articles/curriculum), where prose may legitimately use one.",
    },
    schema: [],
    messages: {
      noEmoji: 'Emoji "{{match}}" is not allowed here. docs/PRD.md §6 rules out emoji icons — use an SVG icon.',
    },
  },
  create(context) {
    function check(node, text) {
      const match = EMOJI_PATTERN.exec(text);
      if (match) {
        context.report({ node, messageId: "noEmoji", data: { match: match[0] } });
      }
    }

    return {
      JSXText(node) {
        check(node, node.value);
      },
      JSXExpressionContainer(node) {
        const expr = node.expression;
        if (expr.type === "Literal" && typeof expr.value === "string") {
          check(expr, expr.value);
        } else if (expr.type === "TemplateLiteral") {
          for (const quasi of expr.quasis) {
            if (quasi.value.cooked) check(quasi, quasi.value.cooked);
          }
        }
      },
      JSXAttribute(node) {
        if (node.value && node.value.type === "Literal" && typeof node.value.value === "string") {
          check(node.value, node.value.value);
        }
      },
    };
  },
};

/** @type {{ rules: Record<string, unknown> }} */
const ooccPlugin = {
  rules: {
    "no-decorative-utilities": noDecorativeUtilities,
    "no-emoji-jsx": noEmojiJsx,
  },
};

export default ooccPlugin;
