import { Lineicons } from '@lineiconshq/react-lineicons';
import {
  ArrowAngularTopRightOutlined,
  ArrowDownwardOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpwardOutlined,
  CreditCardMultipleOutlined,
  DashboardSquare1Outlined,
  FileQuestionOutlined,
  HandTakingDollarOutlined,
  MenuMeatballs1Outlined,
  RefreshDollar1Outlined,
  ShiftLeftOutlined,
  ShiftRightOutlined,
  SlidersHorizontalSquare2Outlined,
  Wallet1Outlined,
  User4Outlined,
  Pencil1Outlined,
  Trash3Outlined,
  FilePlusCircleOutlined,
} from '@lineiconshq/free-icons';

const icons = {
  ArrowAngularTopRightOutlined,
  ArrowDownwardOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined,
  ArrowUpwardOutlined,
  CreditCardMultipleOutlined,
  DashboardSquare1Outlined,
  FileQuestionOutlined,
  HandTakingDollarOutlined,
  MenuMeatballs1Outlined,
  RefreshDollar1Outlined,
  ShiftLeftOutlined,
  ShiftRightOutlined,
  SlidersHorizontalSquare2Outlined,
  Wallet1Outlined,
  User4Outlined,
  Pencil1Outlined,
  Trash3Outlined,
  FilePlusCircleOutlined,
};

export type IconName = keyof typeof icons;

interface IconProps extends Omit<React.ComponentProps<typeof Lineicons>, 'icon'> {
  name: IconName;
}

export function Icon({ name, size = 32, ...props }: IconProps) {
  const icon = icons[name];

  return <Lineicons icon={icon} size={size} {...props} />;
}
