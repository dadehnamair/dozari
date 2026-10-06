import { StyleSheet, Text } from 'react-native';
import { smearsDarkText } from './darkText';

type Renderable = { render?: (props: { style?: unknown }, ref: unknown) => unknown };

/**
 * Drops the text shadow of any `Text` whose colour is dark, everywhere (buttons, plates, labels), so a screen never has to
 * remember it. Light text keeps its shadow. Installed once at start; harmless where `Text` has no `render`.
 */
export function installDarkTextShadowFix(): void {
  const target = Text as unknown as Renderable & { __darkShadowFix?: boolean };
  if (target.__darkShadowFix || typeof target.render !== 'function') return;
  target.__darkShadowFix = true;
  const original = target.render;
  target.render = function render(this: unknown, props, ref) {
    const next = props && smearsDarkText(StyleSheet.flatten(props.style as never)) ? { ...props, style: [props.style, { textShadowColor: 'transparent', textShadowRadius: 0 }] } : props;
    return original.call(this, next, ref);
  };
}
