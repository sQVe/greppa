import { Badge } from './Badge';
import type { BadgeVariant } from './Badge';

const variants: BadgeVariant[] = ['added', 'deleted', 'modified', 'renamed'];

const BadgePreview = () => (
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {variants.map((variant) => (
      <Badge key={variant} variant={variant}>
        {variant}
      </Badge>
    ))}
  </div>
);

export default BadgePreview;
