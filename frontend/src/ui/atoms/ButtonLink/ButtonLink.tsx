import { Link, type LinkProps } from 'react-router';
import { cx } from '../../lib/cx';
import {
  buttonBase,
  buttonSizes,
  buttonVariants,
  type ButtonSize,
  type ButtonVariant,
} from '../Button';
import { Icon, type IconName } from '../Icon';

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: IconName;
  rightIcon?: IconName;
}

/** Navigatsiya (havola semantikasi), ko'rinishi — Button bilan bir xil. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  const iconSize = size === 'lg' ? 'md' : 'sm';
  return (
    <Link
      className={cx(buttonBase, buttonVariants[variant], buttonSizes[size], className)}
      {...rest}
    >
      {leftIcon && <Icon name={leftIcon} size={iconSize} />}
      {children}
      {rightIcon && <Icon name={rightIcon} size={iconSize} />}
    </Link>
  );
}
