import type { MaterialIcon } from 'vscode-material-icons';
import {
  getIconForDirectoryPath,
  getIconUrlByName,
  getIconUrlForFilePath,
} from 'vscode-material-icons';

interface FileIconProps {
  name: string;
  isDirectory?: boolean;
  isExpanded?: boolean;
}

const ICONS_BASE_URL = '/material-icons';

export const FileIcon = ({ name, isDirectory, isExpanded }: FileIconProps) => {
  let src: string;

  if (isDirectory) {
    const iconName = getIconForDirectoryPath(name);
    // oxlint-disable-next-line no-unsafe-type-assertion -- vscode-material-icons uses `${name}-open` convention for expanded folders
    const resolvedName = (isExpanded ? `${iconName}-open` : iconName) as MaterialIcon;
    src = getIconUrlByName(resolvedName, ICONS_BASE_URL);
  } else {
    src = getIconUrlForFilePath(name, ICONS_BASE_URL);
  }

  return <img src={src} alt="" width={16} height={16} aria-hidden="true" />;
};
