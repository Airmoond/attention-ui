import { iconPaths } from "../../../../packages/ui/icons"

export const Icon = ({ name, className = "" }: { name: keyof typeof iconPaths; className?: string }): React.JSX.Element => (
  <svg className={`aui-icon ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={iconPaths[name]} /></svg>
)
