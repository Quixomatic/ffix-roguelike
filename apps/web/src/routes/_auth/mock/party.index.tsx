import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth/mock/party/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/_auth/mock/party/"!</div>
}
