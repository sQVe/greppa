import { Tabs } from './Tabs';

const TabsPreview = () => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <Tabs.Root defaultValue="changes">
      <Tabs.List>
        <Tabs.Trigger value="changes">Changes</Tabs.Trigger>
        <Tabs.Trigger value="history">History</Tabs.Trigger>
        <Tabs.Trigger value="stash">Stash</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="changes">
        <p>Staged and unstaged file changes appear here.</p>
      </Tabs.Content>
      <Tabs.Content value="history">
        <p>Commit history for the current branch.</p>
      </Tabs.Content>
      <Tabs.Content value="stash">
        <p>Stashed changes that can be re-applied.</p>
      </Tabs.Content>
    </Tabs.Root>

    <Tabs.Root defaultValue="unified">
      <Tabs.List>
        <Tabs.Trigger value="unified">Unified</Tabs.Trigger>
        <Tabs.Trigger value="split">Split</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="unified">
        <p>Unified diff view.</p>
      </Tabs.Content>
      <Tabs.Content value="split">
        <p>Side-by-side diff view.</p>
      </Tabs.Content>
    </Tabs.Root>
  </div>
);

export default TabsPreview;
