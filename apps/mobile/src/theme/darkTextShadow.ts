import { StyleSheet, Text } from 'react-native';
import { brightnessOf, smearsDarkText } from './darkText';

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
    const flat = props ? (StyleSheet.flatten(props.style as never) as { color?: unknown; textShadowColor?: unknown } | undefined) : undefined;
    // A «transparent» shadow still paints black on the web, so the shadow is also moved under the glyph and its blur removed.
    const kill = !!flat && (smearsDarkText(flat) || (flat.textShadowColor === 'transparent' && (brightnessOf(flat.color) ?? 1) < 0.4));
    const next = props && kill ? { ...props, style: [props.style, { textShadowColor: 'transparent', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 0 }] } : props;
    return original.call(this, next, ref);
  };
}
