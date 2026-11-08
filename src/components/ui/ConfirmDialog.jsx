import Modal from './Modal.jsx'
import Button from './Button.jsx'
export default function ConfirmDialog({open,onClose,onConfirm,title='Are you sure?',body}){ return <Modal open={open} onClose={onClose} title={title}><p className="my-4">{body||'This action cannot be undone.'}</p><div className="flex gap-2 justify-end"><button onClick={onClose} className="px-4 py-2 rounded-full border-2">Cancel</button><Button onClick={onConfirm}>Confirm</Button></div></Modal> }
