;; SPDX-License-Identifier: MIT
;; Contract: chainpayroll.clar
;; Description: Verifiable, on-chain invoices + payments with event logs for Chainhooks

;; -----------------------------
;; Constants and Types
;; -----------------------------

(define-constant ERR-NOT-FOUND (err u404))
(define-constant ERR-ALREADY-PAID (err u409))
(define-constant ERR-INVALID-AMOUNT (err u400))
(define-constant ERR-NOT-RECIPIENT (err u403))

(define-constant STATUS-UNPAID u0)
(define-constant STATUS-PAID u1)

;; The invoice record saved on-chain
(define-map invoices 
  { id: uint } 
  { 
    creator: principal,
    recipient: principal,
    amount: uint,
    status: uint,
    created-height: uint,
    paid-height: (optional uint),
    payer: (optional principal)
  }
)

(define-data-var invoice-counter uint u0)

;; -----------------------------
;; Helpers
;; -----------------------------

(define-read-only (get-invoice-count)
  (ok (var-get invoice-counter))
)

(define-read-only (get-invoice (invoice-id uint))
  (match (map-get? invoices { id: invoice-id })
    invoice (ok invoice)
    (err u404)
  )
)

;; Utility: ensure invoice exists, returning the tuple
(define-private (ensure-invoice (invoice-id uint))
  (match (map-get? invoices { id: invoice-id })
    invoice (ok invoice)
    ERR-NOT-FOUND
  )
)

;; -----------------------------
;; Public Functions
;; -----------------------------

;; Create a new invoice on-chain.
;; - Auto-assigns an incrementing invoice ID.
;; - Stores creator, recipient, amount, and created-height.
;; Returns: (ok {id: uint})
(define-public (create-invoice (recipient principal) (amount uint))
  (begin
    (asserts! (> amount u0) ERR-INVALID-AMOUNT)
    (let ((next-id (+ u1 (var-get invoice-counter))))
      (var-set invoice-counter next-id)
      (map-set invoices 
        { id: next-id }
        { 
          creator: tx-sender,
          recipient: recipient,
          amount: amount,
          status: STATUS-UNPAID,
          created-height: stacks-block-height,
          paid-height: none,
          payer: none
        }
      )
      ;; Event for indexing / UI
      (print { 
        event: "invoice-created",
        id: next-id,
        creator: tx-sender,
        recipient: recipient,
        amount: amount,
        created-height: stacks-block-height
      })
      (ok { id: next-id })
    )
  )
)

;; Pay an existing invoice.
;; - Transfers STX from tx-sender to invoice recipient.
;; - Marks status as PAID and records payer + paid-height.
;; - Emits an event usable by Chainhooks.
;; Returns: (ok true)
(define-public (pay-invoice (invoice-id uint))
  (let (
    (inv (unwrap! (ensure-invoice invoice-id) ERR-NOT-FOUND))
    (recipient (get recipient inv))
    (amount (get amount inv))
    (status (get status inv))
  )
    (begin
      (asserts! (not (is-eq status STATUS-PAID)) ERR-ALREADY-PAID)
      
      ;; Perform STX transfer from payer (tx-sender) to invoice recipient
      (unwrap! (stx-transfer? amount tx-sender recipient) (err u500))
      
      ;; Update invoice status to paid, set payer and paid-height
      (map-set invoices 
        { id: invoice-id }
        { 
          creator: (get creator inv),
          recipient: recipient,
          amount: amount,
          status: STATUS-PAID,
          created-height: (get created-height inv),
          paid-height: (some stacks-block-height),
          payer: (some tx-sender)
        }
      )
      
      ;; Emit event for Chainhooks (contract_log). 
      ;; Chainhook can filter on contract_call: pay-invoice
      ;; and also parse this event payload if desired.
      (print { 
        event: "invoice-paid",
        id: invoice-id,
        payer: tx-sender,
        recipient: recipient,
        amount: amount,
        paid-height: stacks-block-height
      })
      
      (ok true)
    )
  )
)

;; Helper to build a list item for list-invoices
(define-private (build-invoice-item 
  (idx uint) 
  (acc (list 50 { 
    id: uint, 
    creator: principal, 
    recipient: principal, 
    amount: uint, 
    status: uint, 
    created-height: uint, 
    paid-height: (optional uint), 
    payer: (optional principal) 
  })))
  (match (map-get? invoices { id: idx })
    invoice (unwrap-panic (as-max-len? (append acc (merge invoice { id: idx })) u50))
    acc
  )
)

;; List invoices with pagination
;; Returns up to 50 invoices starting from offset
;; Note: This will return only existing invoices, skipping gaps in IDs
(define-read-only (list-invoices (offset uint) (limit uint))
  (let (
    (start (if (< offset u1) u1 offset))
    (actual-limit (if (> limit u50) u50 limit))
    (count (var-get invoice-counter))
    (end (if (> (+ start actual-limit) count) 
           (+ count u1) 
           (+ start actual-limit)))
  )
    (ok (fold build-invoice-item 
      (list 
        start 
        (+ start u1) (+ start u2) (+ start u3) (+ start u4) (+ start u5)
        (+ start u6) (+ start u7) (+ start u8) (+ start u9) (+ start u10)
        (+ start u11) (+ start u12) (+ start u13) (+ start u14) (+ start u15)
        (+ start u16) (+ start u17) (+ start u18) (+ start u19) (+ start u20)
        (+ start u21) (+ start u22) (+ start u23) (+ start u24) (+ start u25)
        (+ start u26) (+ start u27) (+ start u28) (+ start u29) (+ start u30)
        (+ start u31) (+ start u32) (+ start u33) (+ start u34) (+ start u35)
        (+ start u36) (+ start u37) (+ start u38) (+ start u39) (+ start u40)
        (+ start u41) (+ start u42) (+ start u43) (+ start u44) (+ start u45)
        (+ start u46) (+ start u47) (+ start u48) (+ start u49)
      )
      (list)
    ))
  )
)