# Global Hover Interaction System

## Overview

The Unifolio app now features a premium, theme-aware global hover interaction system that applies to all clickable elements across the entire application.

Every button, card, row, icon, dropdown, ticker, and interactive control subtly "lights up" when hovered, creating a polished, responsive feel without being distracting.

## Core Principles

- **Theme-Matched**: All hover colors use the active theme's accent and primary colors
- **Smooth**: 150ms cubic-bezier transitions for premium feel
- **Minimal**: Small movements (1-3px) and subtle glows
- **Accessible**: Respects `prefers-reduced-motion` and maintains readable contrast
- **Mobile-Friendly**: Touch-friendly tap effects instead of hover on mobile

## CSS Classes

The system provides reusable utility classes that can be applied to any element:

### Button Hover Classes

```html
<!-- Default button with hover effect -->
<button class="btn-hover">Click Me</button>

<!-- Light button hover (outline/secondary buttons) -->
<button class="btn-hover btn-hover-light">Click Me</button>

<!-- Strong button hover (primary/action buttons) -->
<button class="btn-hover btn-hover-strong">Click Me</button>
```

**Behavior**: Moves up 2px, smooth color transition, theme-matched accent

### Card Hover Classes

```html
<!-- Clickable card -->
<div class="card-hover rounded-lg border">Content</div>

<!-- Stat card (metrics, values) -->
<div class="stat-card-hover rounded-lg border">$1,234.56</div>
```

**Behavior**: Moves up 2px, border accent, soft glow, background lighten

### Row Hover Classes

```html
<!-- Clickable table row -->
<tr class="row-hover">
  <td>AAPL</td>
  <td>$150.25</td>
</tr>
```

**Behavior**: Soft background highlight, left accent border (3px), subtle shift

### Icon Hover Classes

```html
<!-- Icon button -->
<button class="icon-hover">
  <Eye class="w-4 h-4" />
</button>

<!-- Icon with background glow -->
<button class="icon-hover icon-hover-bg">
  <Star class="w-4 h-4" />
</button>
```

**Behavior**: Color change to primary, slight scale up (1.1x), optional background glow

### Value/Ticker Hover Classes

```html
<!-- Financial value/number -->
<span class="value-hover">+$1,234.56</span>

<!-- Stock ticker link -->
<button class="ticker-hover">AAPL</button>
```

**Behavior**: Text color shifts to primary, soft text shadow, subtle lift

### Dropdown Item Hover

Standard Radix UI dropdowns automatically get hover styling. No additional classes needed.

## JavaScript Hook

For React components, use the `useHoverInteraction()` hook:

```jsx
import { useHoverInteraction } from '@/hooks/useHoverInteraction';

export function MyComponent() {
  const { button, card, row, icon, ticker, value, statCard } = useHoverInteraction();

  return (
    <>
      <button className={button()}>Default</button>
      <button className={button('strong')}>Primary</button>
      <button className={button('light')}>Secondary</button>
      
      <div className={card()}>Clickable Card</div>
      <tr className={row()}>Table Row</tr>
      <button className={icon()}>Icon</button>
      <span className={value()}>$123.45</span>
    </>
  );
}
```

## Quick Reference Classes

```js
// From lib/hoverClasses.js
{
  button: 'btn-hover',
  buttonLight: 'btn-hover btn-hover-light',
  buttonStrong: 'btn-hover btn-hover-strong',
  card: 'card-hover',
  statCard: 'stat-card-hover',
  row: 'row-hover',
  icon: 'icon-hover',
  iconWithBg: 'icon-hover icon-hover-bg',
  ticker: 'ticker-hover',
  value: 'value-hover',
}
```

## Where Hover Effects Are Applied

### Dashboard
- ✅ Stat cards
- ✅ Portfolio chart buttons
- ✅ Sidebar navigation
- ✅ Market ticker items
- ✅ Account allocation cards

### Holdings
- ✅ Table rows (expand/collapse)
- ✅ Filter buttons
- ✅ Column customization button
- ✅ Export button
- ✅ Heatmap mode selector

### Watchlist
- ✅ Watchlist selector dropdown
- ✅ Add security button
- ✅ Search input
- ✅ Table rows
- ✅ Explore carousel cards

### Settings
- ✅ Theme selector
- ✅ Currency options
- ✅ Toggle switches (privacy, live data)
- ✅ All control buttons

### All Pages
- ✅ Sidebar navigation links
- ✅ Top-right control buttons
- ✅ Modal action buttons
- ✅ Dropdown menus
- ✅ Icon buttons (eye, star, edit, delete, etc.)

## Theme Integration

Hover colors automatically match the active theme:

### Bloomberg Black
- Primary: Cyan blue (#3B82F6)
- Accent: Amber gold (#FCD34D)
- Hover text: Bright cyan with soft glow

### Other Themes
- Primary: Theme-specific primary color
- Accent: Theme-specific accent color
- All hover effects adapt automatically

## Accessibility

### Respects Reduced Motion

If the user has `prefers-reduced-motion` enabled:
- ✅ Color hover effects still work
- ✅ Movement animations are disabled
- ✅ Scale/transform effects are removed
- ✅ All interactions remain responsive

### Keyboard Navigation

All hover effects work with keyboard focus:
- Elements that can receive focus respond to hover styling
- Contrast is maintained for readability
- No reliance on color alone for interaction cues

### Mobile Touch

On mobile devices:
- Hover doesn't exist; instead uses active/tap states
- Slight scale-down effect (0.98) on press
- Quick opacity change for feedback
- No sticky hover states after tapping

## Motion Specifications

### Timing
- Duration: 150ms
- Easing: cubic-bezier(0.4, 0, 0.2, 1) (ease-out)
- Smooth, responsive feel

### Movement
- Buttons: Move up 2px
- Cards: Move up 2px
- Rows: Optional shift left (3px border)
- Icons: Scale 1.1x
- Values: Text shadow glow

### No Aggressive Effects
- ❌ No bouncing animations
- ❌ No flashy neon effects
- ❌ No slow sluggish movement
- ❌ No overly dramatic scaling
- ✅ Premium, minimal, refined

## Implementation Examples

### Button with Hover

```jsx
<Button 
  variant="primary" 
  className="btn-hover-strong"
>
  Submit
</Button>
```

### Card with Hover

```jsx
<div className="card-hover rounded-lg border border-border p-6">
  <h3>Account Summary</h3>
  <p>$12,345.67</p>
</div>
```

### Icon Button with Hover

```jsx
<button className="icon-hover icon-hover-bg p-2 rounded-lg">
  <Eye className="w-4 h-4" />
</button>
```

### Table Row with Hover

```jsx
<tr className="row-hover cursor-pointer">
  <td>AAPL</td>
  <td>$150.25</td>
</tr>
```

### Dropdown Menu Item

```jsx
<SelectItem value="USD" className="transition-all duration-150 hover:bg-accent/20">
  USD
</SelectItem>
```

## Testing Hover Effects

To verify hover effects are working:

1. **Desktop**: Hover over any button, card, or row
   - Should see subtle color/movement change
   - Smooth 150ms transition
   - Theme-matched colors

2. **Mobile**: Tap buttons and cards
   - Should see slight scale-down (0.98)
   - Opacity change
   - No movement on reduced-motion devices

3. **Theme switching**: Change theme in Settings
   - Hover colors should update automatically
   - No visual delay
   - All elements remain responsive

## Performance Considerations

- ✅ Uses CSS transitions (GPU-accelerated)
- ✅ No JavaScript event listeners for basic hover
- ✅ Respects `will-change` best practices
- ✅ No performance impact on live data updates
- ✅ Mobile tap effects are instant

## Common Pitfalls

### ❌ Avoid
- Overriding transition durations (breaks consistency)
- Adding multiple hover classes (causes conflicts)
- Using `!important` on hover styles
- Adding movement to elements with live data

### ✅ Do
- Use the provided utility classes
- Keep transitions at 150ms
- Let hover classes handle all styling
- Test on both desktop and mobile

## Future Enhancements

Potential additions (not in current scope):
- Ripple effects on card clicks
- Color shift animations for theme changes
- Advanced gesture effects for mobile
- Voice/haptic feedback integration
- Custom hover curves per theme

## Support

For questions or issues with hover effects:
1. Check that the element has the correct hover class
2. Verify the theme is properly loaded
3. Test in both desktop and mobile viewports
4. Check browser DevTools for CSS conflicts
5. Ensure `prefers-reduced-motion` is working correctly