;; Generator Verification Contract
;; Validates clean energy producers

(define-data-var admin principal tx-sender)

;; Generator status: 0 = pending, 1 = verified, 2 = rejected
(define-map generators
  { generator-id: uint }
  {
    owner: principal,
    name: (string-utf8 100),
    location: (string-utf8 100),
    capacity-kw: uint,
    technology-type: (string-utf8 50),
    status: uint,
    verification-date: uint
  }
)

(define-data-var next-generator-id uint u1)

;; Register a new generator
(define-public (register-generator
                (name (string-utf8 100))
                (location (string-utf8 100))
                (capacity-kw uint)
                (technology-type (string-utf8 50)))
  (let ((generator-id (var-get next-generator-id)))
    (asserts! (> (len name) u0) (err u1))
    (asserts! (> (len location) u0) (err u2))
    (asserts! (> capacity-kw u0) (err u3))
    (asserts! (> (len technology-type) u0) (err u4))

    (map-set generators
      { generator-id: generator-id }
      {
        owner: tx-sender,
        name: name,
        location: location,
        capacity-kw: capacity-kw,
        technology-type: technology-type,
        status: u0,
        verification-date: u0
      }
    )

    (var-set next-generator-id (+ generator-id u1))
    (ok generator-id)
  )
)

;; Verify a generator (admin only)
(define-public (verify-generator (generator-id uint))
  (let ((generator (unwrap! (map-get? generators { generator-id: generator-id }) (err u10))))
    (asserts! (is-eq tx-sender (var-get admin)) (err u11))
    (asserts! (is-eq (get status generator) u0) (err u12))

    (map-set generators
      { generator-id: generator-id }
      (merge generator {
        status: u1,
        verification-date: block-height
      })
    )
    (ok true)
  )
)

;; Reject a generator (admin only)
(define-public (reject-generator (generator-id uint))
  (let ((generator (unwrap! (map-get? generators { generator-id: generator-id }) (err u10))))
    (asserts! (is-eq tx-sender (var-get admin)) (err u11))
    (asserts! (is-eq (get status generator) u0) (err u12))

    (map-set generators
      { generator-id: generator-id }
      (merge generator {
        status: u2,
        verification-date: block-height
      })
    )
    (ok true)
  )
)

;; Get generator details
(define-read-only (get-generator (generator-id uint))
  (map-get? generators { generator-id: generator-id })
)

;; Check if generator is verified
(define-read-only (is-verified (generator-id uint))
  (match (map-get? generators { generator-id: generator-id })
    generator (is-eq (get status generator) u1)
    false
  )
)

;; Transfer admin rights
(define-public (transfer-admin (new-admin principal))
  (begin
    (asserts! (is-eq tx-sender (var-get admin)) (err u11))
    (var-set admin new-admin)
    (ok true)
  )
)
