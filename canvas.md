<assessmentItem xmlns="http://www.imsglobal.org/xsd/imsqti_v2p1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:m="http://www.w3.org/1998/Math/MathML"
  xsi:schemaLocation="http://www.imsglobal.org/xsd/imsqti_v2p1 
  http://www.imsglobal.org/xsd/qti/qtiv2p1/imsqti_v2p1.xsd"
  identifier="{ITEM_ID}"
  title="{TITLE}"
  adaptive="false"
  timeDependent="false">

  <!-- RESPONSE -->
  <responseDeclaration identifier="RESPONSE" cardinality="single" baseType="float">
    <correctResponse>
      <value>{CORRECT_ANSWER}</value>
    </correctResponse>
  </responseDeclaration>

  <!-- OUTCOMES -->
  <outcomeDeclaration identifier="SCORE" cardinality="single" baseType="float">
    <defaultValue>
      <value>0</value>
    </defaultValue>
  </outcomeDeclaration>

  <outcomeDeclaration identifier="ANSWER_FEEDBACK" cardinality="single" baseType="identifier">
    <defaultValue>
      <value>INCORRECT</value>
    </defaultValue>
  </outcomeDeclaration>

  <!-- ITEM BODY -->
  <itemBody>

    <!-- QUESTION TEXT -->
    <p>{QUESTION_TEXT}</p>

    <!-- IMAGE (OPTIONAL) -->
    <p>
      <img src="images/{IMAGE_FILENAME}" alt="{IMAGE_ALT_TEXT}"/>
    </p>

    <!-- INPUT -->
    <p>
      Enter your answer:
      <textEntryInteraction responseIdentifier="RESPONSE" expectedLength="10"/>
    </p>

  </itemBody>

  <!-- FEEDBACK -->
  <modalFeedback identifier="CORRECT" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
    <p>{FEEDBACK_CORRECT}</p>
  </modalFeedback>

  <modalFeedback identifier="INCORRECT" outcomeIdentifier="ANSWER_FEEDBACK" showHide="show">
    <p>{FEEDBACK_INCORRECT}</p>
  </modalFeedback>

  <!-- RESPONSE PROCESSING -->
  <responseProcessing>
    <responseCondition>

      <responseIf>
        <stringMatch caseSensitive="false">
          <variable identifier="RESPONSE"/>
          <baseValue baseType="string">{CORRECT_ANSWER}</baseValue>
        </stringMatch>

        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">1</baseValue>
        </setOutcomeValue>

        <setOutcomeValue identifier="ANSWER_FEEDBACK">
          <baseValue baseType="identifier">CORRECT</baseValue>
        </setOutcomeValue>
      </responseIf>

      <responseElse>
        <setOutcomeValue identifier="SCORE">
          <baseValue baseType="float">0</baseValue>
        </setOutcomeValue>

        <setOutcomeValue identifier="ANSWER_FEEDBACK">
          <baseValue baseType="identifier">INCORRECT</baseValue>
        </setOutcomeValue>
      </responseElse>

    </responseCondition>
  </responseProcessing>

</assessmentItem>