import Foundation
import Testing
@testable import Static

struct ScrollStepperTests {
    @Test func theFirstEventOfAGestureStepsAtOnce() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 1, at: 0) == 1)

        var backwards = ScrollStepper(step: 12)
        #expect(backwards.scroll(by: -1, at: 0) == -1)
    }

    @Test func laterEventsStepOncePerStepOfDistance() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 5, at: 0) == 1)
        #expect(stepper.scroll(by: 5, at: 0.01) == nil)
        #expect(stepper.scroll(by: 5, at: 0.02) == nil)
        #expect(stepper.scroll(by: 5, at: 0.03) == 1)
        // 3 points were left over, so 9 more make the next step.
        #expect(stepper.scroll(by: 8, at: 0.04) == nil)
        #expect(stepper.scroll(by: 1, at: 0.05) == 1)
    }

    @Test func aBigEventStillMovesOneStation() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 1, at: 0) == 1)
        #expect(stepper.scroll(by: 100, at: 0.01) == 1)
        // 100 % 12 leaves 4 points, so 7 more aren't a step yet.
        #expect(stepper.scroll(by: 7, at: 0.02) == nil)
    }

    @Test func reversingStartsCountingAgain() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 1, at: 0) == 1)
        #expect(stepper.scroll(by: 10, at: 0.01) == nil)
        #expect(stepper.scroll(by: -10, at: 0.02) == nil)
        #expect(stepper.scroll(by: -2, at: 0.03) == -1)
    }

    @Test func aPauseStartsANewGesture() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 1, at: 0) == 1)
        #expect(stepper.scroll(by: 1, at: 0.1) == nil)
        #expect(stepper.scroll(by: 1, at: 0.1 + ScrollStepper.gestureGap + 0.001) == 1)
    }

    @Test func zeroDeltasDoNothing() {
        var stepper = ScrollStepper(step: 12)
        #expect(stepper.scroll(by: 0, at: 0) == nil)
        #expect(stepper.scroll(by: 1, at: 0.01) == 1)
    }
}
