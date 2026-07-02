import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AccountBridgeEmbed } from './AccountBridgeEmbed.js';

describe('AccountBridgeEmbed enabled flag', () => {
  it('renders children untouched when enabled is false', () => {
    const html = renderToStaticMarkup(
      createElement(
        AccountBridgeEmbed,
        { appId: 'demo-app', enabled: false, mode: 'gate' },
        createElement('p', { id: 'feature' }, 'my feature'),
      ),
    );

    expect(html).toBe('<p id="feature">my feature</p>');
  });

  it('renders nothing when disabled with no children', () => {
    const html = renderToStaticMarkup(
      createElement(AccountBridgeEmbed, { appId: 'demo-app', enabled: false }),
    );

    expect(html).toBe('');
  });
});
