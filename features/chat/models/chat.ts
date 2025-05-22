export interface Message {
  id: string
  role: string
  content: string
  timestamp: string
  stageIndex?: number
  displayRole?: string
}