// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title RicePayTransferPull (offchain-verified, on-chain lightweight fee)
/// @notice 사용자가 직접 트랜잭션을 보낼 때만 실행됨 (msg.sender == owner).
///         온체인은 서명 검증을 하지 않고 transferFrom/transfer만 수행하여 가스를 크게 절감.
contract RicePayTransferPull is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---- Errors ----
    error ZeroAmount();
    error InvalidFeeRecipient();
    error FeeTooHigh();
    error NotOwner(); // msg.sender != owner

    // ---- Immutables ----
    IERC20  public immutable USDC;          // 6 decimals 가정
    address public immutable FEE_RECIPIENT; // 수수료 지갑

    // ---- Fee policy (2-decimal BPS) ----
    // 0.39% = 39 / 10000
    uint256 public constant FEE_BPS_2DEC   = 39;
    uint256 public constant BPS_2DEC_DENOM = 10000;
    // Clamp (USDC 6d)
    uint256 public constant MIN_FEE_USDC   = 250_000;   // 0.25 USDC
    uint256 public constant MAX_FEE_USDC   = 3_900_000; // 3.90 USDC

    // ---- Events ----
    event TransferWithFee(
        address indexed owner,
        address indexed to,
        uint256 amount, // 총액
        uint256 net,    // 수취인 금액
        uint256 fee     // 수수료
    );

    constructor(address _usdc, address _feeRecipient) {
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        USDC = IERC20(_usdc);
        FEE_RECIPIENT = _feeRecipient;
    }

    /// @notice (가스 최소) 소유자 지갑에서 이 컨트랙트가 amount를 당겨와, to/fee 로 분배
    /// @dev  사전 조건: 소유자(owner=msg.sender)는 이 컨트랙트에 대해 `approve(amount)`가 되어 있어야 함.
    /// @param to     최종 수취인
    /// @param amount 총 전송액(수취인+수수료), USDC 6 decimals
    function transferWithFee(address to, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        address owner = msg.sender; // 호출자가 곧 소유자 (offchain 검증 대체)

        // 1) 수수료 계산(클램프) — pull 이전에 컷하여 가스 낭비 방지
        // #change
        (uint256 fee, uint256 net) = _calcFee(amount);
        // uint256 fee = 1000; #change
        // uint256 net = amount - 1000; #change
        if (fee > amount) revert FeeTooHigh();

        // 2) owner -> this (총액) pull
        USDC.safeTransferFrom(owner, address(this), amount);

        // 3) 내부 분배
        if (net > 0) {
            USDC.safeTransfer(to, net);
        }
        if (fee > 0) {
            USDC.safeTransfer(FEE_RECIPIENT, fee);
        }

        emit TransferWithFee(owner, to, amount, net, fee);
    }

    /// @notice 수수료/순액 계산 도우미 (프론트 프리뷰용)
    function quote(uint256 amount) external pure returns (uint256 fee, uint256 net) {
        return _calcFee(amount);
    }

    /// @notice 최소 전송 가능 금액(= 1 usdc)
    function minSend() external pure returns (uint256) {
        return 1000000;
    }

    // ---- internal ----

    function _calcFee(uint256 amount) internal pure returns (uint256 fee, uint256 net) {
        // 0.39% (2-decimal BPS)
        uint256 rawFee = (amount * FEE_BPS_2DEC) / BPS_2DEC_DENOM;
        if (rawFee < MIN_FEE_USDC) fee = MIN_FEE_USDC;
        else if (rawFee > MAX_FEE_USDC) fee = MAX_FEE_USDC;
        else fee = rawFee;

        if (fee > amount) {
            // 호출부에서 FeeTooHigh 처리 — 여기서는 net=0으로 리턴
            net = 0;
            return (fee, net);
        }
        net = amount - fee;
    }
}