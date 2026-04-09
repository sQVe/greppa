import type { MaterialIcon } from 'vscode-material-icons';
import {
  getIconForDirectoryPath,
  getIconUrlByName,
  getIconUrlForFilePath,
} from 'vscode-material-icons';

interface FileIconProps {
  name: string;
  baseUrl: string;
  isDirectory?: boolean;
  isExpanded?: boolean;
}

export const FileIcon = ({ name, baseUrl, isDirectory, isExpanded }: FileIconProps) => {
  let src: string;

  if (isDirectory) {
    const iconName = getIconForDirectoryPath(name);
    // oxlint-disable-next-line no-unsafe-type-assertion -- vscode-material-icons uses `${name}-open` convention for expanded folders
    const resolvedName = (isExpanded ? `${iconName}-open` : iconName) as MaterialIcon;
    src = getIconUrlByName(resolvedName, baseUrl);
  } else {
    src = getIconUrlForFilePath(name, baseUrl);
  }

  return <img src={src} alt="" width={16} height={16} aria-hidden="true" />;
};
