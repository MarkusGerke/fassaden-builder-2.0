/* @refresh reload */
import { render } from 'solid-js/web'
import SandboxApp from './SandboxApp'

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')
render(() => <SandboxApp />, root)
