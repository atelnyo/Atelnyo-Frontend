/**
 * eslint-rules/no-function-in-deps.js
 *
 * Custom ESLint rule that prevents arrow functions / function expressions
 * from being used in useCallback() or useMemo() dependency arrays.
 *
 * WHY: When a function is defined inside a component body (e.g. `const t = (en, ht) => ...`),
 * it creates a NEW reference on every render. If that function is listed in a useCallback
 * or useMemo dependency array, the hook is recreated every render — causing:
 *   1. Infinite loops when the hook's result feeds a useEffect
 *   2. Unnecessary re-renders and wasted computation
 *
 * FIX: Use stable values (props, state, or other hooks) instead of inline functions
 * in dependency arrays.
 *
 * Example BAD:
 *   const t = (en, ht) => (isHt ? ht : en);
 *   const load = useCallback(async () => { ... t('...') ... }, [courseId, t]); // ❌
 *
 * Example GOOD:
 *   const t = (en, ht) => (isHt ? ht : en);
 *   const load = useCallback(async () => { ... t('...') ... }, [courseId, lang]); // ✅
 */

const HOOK_NAMES = new Set(['useCallback', 'useMemo']);

/** Check if a node is an arrow function or function expression. */
function isFunctionNode(node) {
  return (
    node &&
    (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')
  );
}

export default {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow functions in useCallback/useMemo dependency arrays',
      category: 'Best Practices',
      recommended: true,
    },
    messages: {
      noFunctionInDeps:
        '`{{name}}` is a function defined in this component scope. ' +
        'Including it in the {{hook}} dependency array causes a new reference every render. ' +
        'Use a stable value (props, state, or a hook parameter like `lang`) instead.',
    },
    schema: [],
  },

  create(context) {
    // Track variable names that are assigned arrow/function expressions
    const functionVarNames = new Set();

    return {
      VariableDeclarator(node) {
        if (
          node.id?.type === 'Identifier' &&
          node.init &&
          isFunctionNode(node.init)
        ) {
          functionVarNames.add(node.id.name);
        }
      },

      CallExpression(node) {
        const calleeName = node.callee?.name;
        if (!HOOK_NAMES.has(calleeName)) return;

        // The dependency array is the last argument
        const args = node.arguments || [];
        const depsArray = args[args.length - 1];
        if (!depsArray || depsArray.type !== 'ArrayExpression') return;

        for (const elem of depsArray.elements) {
          if (!elem || elem.type !== 'Identifier') continue;
          const name = elem.name;

          if (functionVarNames.has(name)) {
            context.report({
              node: elem,
              messageId: 'noFunctionInDeps',
              data: { name, hook: calleeName },
            });
          }
        }
      },
    };
  },
};
